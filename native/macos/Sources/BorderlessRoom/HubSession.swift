import Foundation

public struct HubSnapshot: Decodable, Sendable {
    public struct Person: Decodable, Sendable { public let id: String; public let csrf: String }
    public struct Stream: Decodable, Sendable { public let id: String; public let ownerId: String; public let connectionId: String? }
    public let id: String
    public let name: String
    public let me: Person
    public let streams: [Stream]
    public let ended: Bool
}

public struct MediaGrant: Decodable, Sendable {
    public let url: String
    public let room: String
    public let token: String
    public let publisher: Bool
}

public enum HubError: LocalizedError {
    case message(String)
    public var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

private final class NoRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// Ephemeral participant session in the existing hub. No authority or credentials
/// are stored on disk, and redirects never carry the room session elsewhere.
@MainActor public final class HubSession {
    public let origin: URL
    public let roomID: String
    public private(set) var connectionID: String?
    public private(set) var snapshot: HubSnapshot?
    private let session: URLSession
    private var socket: URLSessionWebSocketTask?
    private var watch: Task<Void, Never>?
    public var changed: ((HubSnapshot) -> Void)?
    public var disconnected: (() -> Void)?

    public init(origin: URL, roomID: String) throws {
        guard Self.isTrustedOrigin(origin), roomID.count >= 8, roomID.count <= 48,
              roomID.utf8.allSatisfy({ (48...57).contains($0) || (65...90).contains($0) || (97...122).contains($0) || $0 == 45 || $0 == 95 }) else {
            throw HubError.message("Enter a trusted HTTPS hub origin and a valid room ID. Local development may use loopback HTTP.")
        }
        self.origin = origin; self.roomID = roomID
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        config.urlCache = nil
        session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }

    public static func isTrustedOrigin(_ url: URL) -> Bool {
        let local = ["127.0.0.1", "localhost", "[::1]"].contains(url.host ?? "")
        return url.host != nil && (url.scheme == "https" || (url.scheme == "http" && local)) &&
            url.user == nil && url.password == nil && url.query == nil && url.fragment == nil &&
            (url.path.isEmpty || url.path == "/")
    }

    public static func address(from link: String) throws -> (origin: URL, roomID: String) {
        guard let url = URL(string: link.trimmingCharacters(in: .whitespacesAndNewlines)),
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              url.query == nil, url.fragment == nil else { throw HubError.message("Paste the room's participant invitation link.") }
        let parts = url.path.split(separator: "/")
        guard parts.count == 2, ["join", "portal", "room"].contains(String(parts[0])) else {
            throw HubError.message("Use a participant room link, not a Wall pairing link.")
        }
        components.path = ""
        guard let origin = components.url, isTrustedOrigin(origin) else { throw HubError.message("The room needs trusted HTTPS, except for local development.") }
        return (origin, String(parts[1]))
    }

    public func join(name: String, code: String) async throws {
        _ = try await request("join", body: ["name": name, "code": code])
        _ = try await refresh()
        var components = URLComponents(url: endpoint("live"), resolvingAgainstBaseURL: false)!
        components.scheme = origin.scheme == "https" ? "wss" : "ws"
        var request = URLRequest(url: components.url!)
        request.setValue(origin.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forHTTPHeaderField: "Origin")
        // WebSocket cookie handling differs between OS releases. Copy only cookies
        // scoped to this authenticated room endpoint into this one request.
        let cookies = session.configuration.httpCookieStorage?.cookies(for: endpoint("live")) ?? []
        for (key, value) in HTTPCookie.requestHeaderFields(with: cookies) { request.setValue(value, forHTTPHeaderField: key) }
        let ws = session.webSocketTask(with: request)
        ws.maximumMessageSize = 4 * 1024 * 1024
        socket = ws; ws.resume()
        let first = try await event(ws)
        guard first.type == "hello", let id = first.connectionId else { close(); throw HubError.message("The hub did not confirm a live connection.") }
        connectionID = id
        watch = Task { [weak self] in
            do {
                while !Task.isCancelled {
                    guard let self else { return }
                    let value = try await self.event(ws)
                    if let state = value.state {
                        guard state.id == self.roomID else { throw HubError.message("Room identity changed.") }
                        self.snapshot = state; self.changed?(state)
                    }
                }
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.connectionID = nil
                self.disconnected?()
            }
        }
    }

    public func refresh() async throws -> HubSnapshot {
        let state = try JSONDecoder().decode(HubSnapshot.self, from: await request("state"))
        guard state.id == roomID, !state.ended else { throw HubError.message("This room has ended or changed.") }
        snapshot = state
        return state
    }

    public func startStream(title: String) async throws -> String {
        guard let connectionID else { throw HubError.message("Join the room before sharing.") }
        _ = try await command("stream.start", values: ["title": title, "audience": "room", "connectionId": connectionID])
        let state = try await refresh()
        guard let stream = state.streams.first(where: { $0.ownerId == state.me.id && $0.connectionId == connectionID }) else {
            throw HubError.message("The hub did not register this window.")
        }
        return stream.id
    }

    public func stopStream(_ id: String) async throws { _ = try await command("stream.stop", values: ["streamId": id]) }
    public func media(_ id: String) async throws -> MediaGrant {
        guard UUID(uuidString: id) != nil else { throw HubError.message("Invalid stream identifier.") }
        return try JSONDecoder().decode(MediaGrant.self, from: await request("streams/\(id)/media", body: [:]))
    }
    public func close() {
        watch?.cancel(); watch = nil
        socket?.cancel(with: .goingAway, reason: nil); socket = nil
        connectionID = nil
        session.invalidateAndCancel()
    }

    private struct Event: Decodable { let type: String; let connectionId: String?; let state: HubSnapshot? }
    private func event(_ ws: URLSessionWebSocketTask) async throws -> Event {
        let message = try await ws.receive()
        let data: Data
        switch message { case .string(let text): data = Data(text.utf8); case .data(let bytes): data = bytes; @unknown default: throw HubError.message("Invalid room event.") }
        guard data.count <= 4 * 1024 * 1024 else { throw HubError.message("Room event is too large.") }
        return try JSONDecoder().decode(Event.self, from: data)
    }
    private func endpoint(_ route: String) -> URL { origin.appendingPathComponent("api/rooms/\(roomID)/\(route)") }
    private func command(_ type: String, values: [String: String]) async throws -> Data {
        var body = values; body["type"] = type; body["commandId"] = UUID().uuidString.lowercased()
        return try await request("command", body: body)
    }
    private func request(_ route: String, body: [String: String]? = nil) async throws -> Data {
        var request = URLRequest(url: endpoint(route))
        if let body {
            request.httpMethod = "POST"
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(snapshot?.me.csrf, forHTTPHeaderField: "X-Borderless-CSRF")
        }
        let (data, response) = try await session.data(for: request)
        guard data.count <= 4 * 1024 * 1024, let http = response as? HTTPURLResponse else { throw HubError.message("Invalid hub response.") }
        guard (200..<300).contains(http.statusCode) else { throw HubError.message("The hub refused this action (\(http.statusCode)). Check the room code, session and permissions.") }
        return data
    }
}
