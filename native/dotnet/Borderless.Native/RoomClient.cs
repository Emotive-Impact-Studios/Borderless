using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text.Json;

namespace Borderless.Native;

/// Authenticated, read-only Wall client for the current compatibility hub.
/// No leader credentials or TLS override. Native clients obey the same room authority.
public sealed class RoomClient : IAsyncDisposable
{
    public const int MaxSnapshotBytes = 4 * 1024 * 1024;
    private readonly CookieContainer cookies = new();
    private readonly HttpClient http;
    private readonly Uri origin;
    private readonly string room;
    private ClientWebSocket? socket;

    public RoomClient(Uri hub, string roomId)
    {
        if (hub.Scheme != "https" && !(hub.Scheme == "http" && hub.IsLoopback))
            throw new ArgumentException("A trusted HTTPS hub is required outside loopback.");
        if (hub.UserInfo.Length > 0 || hub.AbsolutePath != "/" || hub.Query.Length > 0 || hub.Fragment.Length > 0)
            throw new ArgumentException("Hub must be an origin, without credentials or a path.");
        if (roomId.Length is < 8 or > 48 || roomId.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-' && c != '_'))
            throw new ArgumentException("Invalid room identifier.");
        origin = hub; room = roomId;
        http = new HttpClient(new HttpClientHandler { CookieContainer = cookies, AllowAutoRedirect = false })
            { BaseAddress = origin, Timeout = TimeSpan.FromSeconds(10), MaxResponseContentBufferSize = MaxSnapshotBytes };
        http.DefaultRequestHeaders.Add("Origin", origin.GetLeftPart(UriPartial.Authority));
    }

    public async Task PairWallAsync(string token, CancellationToken cancel)
    {
        using var response = await http.PostAsJsonAsync($"api/rooms/{room}/wall-pair", new { token }, cancel);
        response.EnsureSuccessStatusCode();
    }

    public async Task<JsonDocument> SnapshotAsync(CancellationToken cancel)
    {
        using var response = await http.GetAsync($"api/rooms/{room}/state", cancel);
        response.EnsureSuccessStatusCode();
        var bytes = await response.Content.ReadAsByteArrayAsync(cancel);
        return DecodeSnapshot(bytes);
    }

    public static JsonDocument DecodeSnapshot(ReadOnlyMemory<byte> bytes)
    {
        if (bytes.Length == 0 || bytes.Length > MaxSnapshotBytes) throw new InvalidDataException("Snapshot size limit.");
        var doc = JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 32 });
        if (doc.RootElement.ValueKind != JsonValueKind.Object) { doc.Dispose(); throw new InvalidDataException("Snapshot must be an object."); }
        return doc;
    }

    public async IAsyncEnumerable<JsonDocument> WatchAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancel)
    {
        if (socket is not null) throw new InvalidOperationException("One watch connection per client.");
        socket = new ClientWebSocket(); socket.Options.Cookies = cookies;
        socket.Options.SetRequestHeader("Origin", origin.GetLeftPart(UriPartial.Authority));
        var url = new UriBuilder(new Uri(origin, $"api/rooms/{room}/live")) { Scheme = origin.Scheme == "https" ? "wss" : "ws" };
        await socket.ConnectAsync(url.Uri, cancel);
        var buffer = new byte[16 * 1024];
        while (socket.State == WebSocketState.Open)
        {
            using var message = new MemoryStream();
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancel);
                if (result.MessageType == WebSocketMessageType.Close) yield break;
                if (result.MessageType != WebSocketMessageType.Text || message.Length + result.Count > MaxSnapshotBytes)
                    throw new InvalidDataException("Invalid or oversized room event.");
                message.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);
            yield return DecodeSnapshot(message.ToArray()); // caller disposes the document
        }
    }

    public ValueTask DisposeAsync()
    {
        socket?.Abort(); socket?.Dispose(); http.Dispose();
        return ValueTask.CompletedTask;
    }
}
