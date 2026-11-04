using System.Text;
using Borderless.Native;

int passed = 0;
void Check(bool value, string label) { if (!value) throw new Exception(label); passed++; }
void Reject(Action action, string label) { try { action(); } catch (Exception e) when (e is ArgumentException or InvalidDataException or System.Text.Json.JsonException) { passed++; return; } throw new Exception(label); }
Check(NativeCore.Health(true,100,0,0,200)==CaptureHealth.Starting,"transport is not frames");
Check(NativeCore.Health(true,100,0,0,10100)==CaptureHealth.Stale,"first frame timeout");
Check(NativeCore.Health(true,100,200,1,210)==CaptureHealth.Receiving,"complete frame");
Check(NativeCore.Health(false,100,200,1,210)==CaptureHealth.Stopped,"stop");
Check(NativeCore.Health(true,100,300,1,210)==CaptureHealth.Invalid,"future timestamp");
var point=NativeCore.MapDisplay(-1920,0,1920,1080,-1440,270,90);
Check(point.Valid==1 && point.X==0.25 && point.Y==0.75,"Rust struct ABI and negative origin/rotation");
Check(NativeCore.MapDisplay(0,0,0,100,0,0,0).Valid==0,"invalid geometry");
Reject(()=>new RoomClient(new Uri("http://192.0.2.1"),"room-1234"),"insecure LAN");
Reject(()=>new RoomClient(new Uri("https://host/path"),"room-1234"),"origin path");
Reject(()=>new RoomClient(new Uri("https://host"),"../secrets"),"room injection");
Reject(()=>RoomClient.DecodeSnapshot(Encoding.UTF8.GetBytes("[]")),"non-object");
Reject(()=>RoomClient.DecodeSnapshot(new byte[RoomClient.MaxSnapshotBytes+1]),"oversize");
Reject(()=>RoomClient.DecodeSnapshot(Encoding.UTF8.GetBytes("{}{}")),"trailing JSON");
using(var valid=RoomClient.DecodeSnapshot(Encoding.UTF8.GetBytes("{\"revision\":3}"))) Check(valid.RootElement.GetProperty("revision").GetInt32()==3,"JSON snapshot");
const string scene="{\"name\":\"Room\",\"items\":[{\"id\":\"a\",\"title\":\"Note\",\"ownerName\":\"Owner\",\"kind\":\"note\",\"text\":\"Actual text\",\"x\":0.1,\"y\":0.2,\"w\":0.3,\"h\":0.3}]}";
Check(WallSnapshot.Parse(scene).Surfaces.Single().Content=="Actual text","native content model");
Reject(()=>WallSnapshot.Parse(scene.Replace("\"w\":0.3","\"w\":0")),"zero-sized surface");
Reject(()=>WallSnapshot.Parse(scene.Replace("\"x\":0.1","\"x\":2")),"out-of-range surface");

if (args.Length == 2)
{
    // One-use pairing token is supplied on stdin, never in argv or logs.
    var token = await Console.In.ReadLineAsync() ?? throw new Exception("Pairing token required on stdin");
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
    await using var roomClient = new RoomClient(new Uri(args[0]),args[1]);
    await roomClient.PairWallAsync(token,timeout.Token);
    using var state = await roomClient.SnapshotAsync(timeout.Token);
    Check(state.RootElement.GetProperty("me").GetProperty("role").GetString()=="wall","server-issued display role");
    int events=0;
    await foreach(var message in roomClient.WatchAsync(timeout.Token))
    {
        using(message) {
            var type=message.RootElement.GetProperty("type").GetString();
            if(type=="hello" || type=="state") events++;
        }
        if(events==2)break;
    }
    Check(events==2,"native authenticated hello/state");
}
Console.WriteLine($"{passed} native .NET checks passed.");
