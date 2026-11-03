import XCTest
@testable import BorderlessRoom

final class HubSessionTests: XCTestCase {
    @MainActor func testRejectsCredentialAndInsecureOrigins() throws {
        for value in ["http://192.168.1.2", "https://user:secret@example.com", "https://example.com/portal", "https://example.com?token=x", "file:///tmp/hub"] {
            XCTAssertFalse(HubSession.isTrustedOrigin(URL(string: value)!))
        }
        XCTAssertTrue(HubSession.isTrustedOrigin(URL(string: "https://room.example.com")!))
        XCTAssertTrue(HubSession.isTrustedOrigin(URL(string: "http://127.0.0.1:8444")!))
        XCTAssertThrowsError(try HubSession(origin: URL(string: "https://room.example.com")!, roomID: "../../other"))
        let address = try HubSession.address(from: "https://room.example.com/join/abcdefgh")
        XCTAssertEqual(address.origin.absoluteString, "https://room.example.com")
        XCTAssertEqual(address.roomID, "abcdefgh")
        XCTAssertThrowsError(try HubSession.address(from: "https://room.example.com/wall/abcdefgh#pair=secret"))
    }

    /// Run by scripts/test-native-media-session.mjs against the actual Node hub
    /// and actual LiveKit. No saved personal room or credentials are used.
    @MainActor func testRealHubJoinPublishGrantAndStop() async throws {
        let env = ProcessInfo.processInfo.environment
        guard let origin = env["BORDERLESS_TEST_ORIGIN"], let roomID = env["BORDERLESS_TEST_ROOM"], let code = env["BORDERLESS_TEST_CODE"] else {
            throw XCTSkip("Run scripts/test-native-media-session.mjs for real hub/media integration")
        }
        let client = try HubSession(origin: XCTUnwrap(URL(string: origin)), roomID: roomID)
        defer { client.close() }
        try await client.join(name: "Swift media check", code: code)
        XCTAssertNotNil(client.connectionID)
        if env["BORDERLESS_TEST_HOLD"] == "1" {
            // Exercise beyond URLSession's request/resource deadlines and the
            // hub heartbeat; a quick join test cannot prove a lasting session.
            try await Task.sleep(for: .seconds(75))
            XCTAssertNotNil(client.connectionID, "The joined room must survive idle time and heartbeat")
        }
        let id = try await client.startStream(title: "Swift session check")
        let grant = try await client.media(id)
        XCTAssertTrue(grant.publisher)
        XCTAssertFalse(grant.token.isEmpty)
        try await client.stopStream(id)
        let state = try await client.refresh()
        XCTAssertFalse(state.streams.contains { $0.id == id })
        do { _ = try await client.media(id); XCTFail("Stopped stream received a media grant") }
        catch { XCTAssertTrue(error is HubError) }
        // The harness separately checks that closing this owning connection
        // removes the second stream and its actual SFU room.
        let disconnectedID = try await client.startStream(title: "Disconnect cleanup check")
        _ = try await client.media(disconnectedID)
        client.close()
    }
}
