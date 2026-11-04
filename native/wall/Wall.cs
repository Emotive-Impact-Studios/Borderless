using Godot;
using System.Text.Json;
using Borderless.Native;

/// First native room renderer: real authoritative notes and placement, no mock room.
/// Media/file viewers, ink and full interaction are explicit outstanding work.
public partial class Wall : Control
{
    private readonly CancellationTokenSource stop = new();
    private readonly Dictionary<string, PanelContainer> surfaces = new();
    private readonly object gate = new();
    private string? pending;
    private string? pendingStatus;
    private string? currentSnapshot;
    private RoomClient? room;
    private Label status = null!;
    private PanelContainer connection = null!;
    private bool smoke;
    private int smokeFrames;

    public override void _Ready()
    {
        status = new Label { Text = "Borderless · Connect this Wall", Position = new Vector2(24, 16), ZIndex = 100 };
        status.AddThemeColorOverride("font_color",new Color("202b35"));
        AddChild(status);
        connection = new PanelContainer { Position = new Vector2(24,64), CustomMinimumSize = new Vector2(380,0), ZIndex = 100 };
        var form = new VBoxContainer();
        var hub = new LineEdit { PlaceholderText = "Hub origin (https://…)" };
        var id = new LineEdit { PlaceholderText = "Room ID" };
        var token = new LineEdit { PlaceholderText = "One-use Wall pairing token", Secret = true };
        var connect = new Button { Text = "Connect Wall" };
        form.AddChild(hub); form.AddChild(id); form.AddChild(token); form.AddChild(connect);
        connection.AddChild(form); AddChild(connection);
        connect.Pressed += () => {
            if (room is not null) return;
            var secret = token.Text; token.Text = "";
            _ = Connect(hub.Text,id.Text,secret);
        };
        Resized += () => { if (currentSnapshot is not null) ApplySnapshot(currentSnapshot); };
        smoke = OS.GetCmdlineUserArgs().Contains("--smoke");
        if (smoke) {
            connection.Hide();
            ApplySnapshot("{\"name\":\"Native renderer fixture\",\"items\":[{\"id\":\"a\",\"kind\":\"note\",\"title\":\"Source\",\"text\":\"Actual note text\",\"ownerName\":\"Fixture\",\"x\":0.1,\"y\":0.2,\"w\":0.3,\"h\":0.3}]}");
        }
    }

    private async Task Connect(string hub, string id, string token)
    {
        try {
            room = new RoomClient(new Uri(hub),id);
            await room.PairWallAsync(token,stop.Token);
            using (var initial = await room.SnapshotAsync(stop.Token)) QueueSnapshot(initial.RootElement.GetRawText());
            await foreach (var message in room.WatchAsync(stop.Token)) {
                using(message) {
                    var root = message.RootElement;
                    if (root.TryGetProperty("type",out var type) && type.GetString()=="state")
                        QueueSnapshot(root.GetProperty("state").GetRawText());
                }
            }
            lock(gate) pendingStatus="Room disconnected — close and reconnect this Wall";
        } catch (Exception e) {
            lock(gate) pendingStatus=$"Connection unavailable: {e.Message}";
        } finally {
            if (room is not null) await room.DisposeAsync();
            room=null;
        }
    }

    private void QueueSnapshot(string json) { lock(gate) pending=json; }

    public override void _Process(double delta)
    {
        string? next, notice;
        lock(gate) { next=pending; pending=null; notice=pendingStatus; pendingStatus=null; }
        if(next is not null) {
            try { ApplySnapshot(next); connection.Hide(); }
            catch(Exception) { status.Text="Invalid room snapshot — content unchanged"; }
        }
        if(notice is not null) {status.Text=notice;connection.Show();}
        if(smoke && ++smokeFrames==3) {
            var before=surfaces["a"].GetInstanceId();
            if(!surfaces["a"].GetChild<Label>(0).Text.Contains("Actual note text")) {GetTree().Quit(1);return;}
            ApplySnapshot(currentSnapshot!.Replace("\"x\":0.1","\"x\":0.4"));
            if(surfaces["a"].GetInstanceId()!=before || Math.Abs(surfaces["a"].Position.X-Size.X*0.4)>1)
                { GD.PrintErr("Native surface identity/layout failed"); GetTree().Quit(1);return; }
            ApplySnapshot("{\"name\":\"Fixture\",\"items\":[]}");
            if(surfaces.Count!=0) {GetTree().Quit(1);return;}
            GD.Print("Native Godot scene passed: actual text, stable surface, authoritative move/removal.");
            GetTree().Quit();
        }
    }

    private void ApplySnapshot(string json)
    {
        var snapshot=WallSnapshot.Parse(json);
        var ids=new HashSet<string>();
        foreach(var item in snapshot.Surfaces) {
            string id=item.Id;
            ids.Add(id);
            if(!surfaces.TryGetValue(id,out var panel)) {
                panel=new PanelContainer();
                var style=new StyleBoxFlat { BgColor=Colors.White, BorderColor=new Color("d7dadb"), CornerRadiusTopLeft=12,CornerRadiusTopRight=12,CornerRadiusBottomLeft=12,CornerRadiusBottomRight=12,ContentMarginLeft=18,ContentMarginRight=18,ContentMarginTop=14,ContentMarginBottom=14 };
                style.SetBorderWidthAll(1);panel.AddThemeStyleboxOverride("panel",style);
                var text=new Label {AutowrapMode=TextServer.AutowrapMode.WordSmart, ClipText=true};
                text.AddThemeColorOverride("font_color",new Color("202b35"));
                panel.AddChild(text);AddChild(panel);surfaces[id]=panel;
            }
            panel.Position=new Vector2(item.X*Size.X,item.Y*Size.Y);
            panel.Size=new Vector2(item.Width*Size.X,item.Height*Size.Y);
            var label=panel.GetChild<Label>(0);
            label.Text=$"{item.Title} · {item.Owner}\n\n{item.Content}";
        }
        foreach(var old in surfaces.Keys.Where(id=>!ids.Contains(id)).ToArray()) {surfaces[old].QueueFree();surfaces.Remove(old);}
        currentSnapshot=json;
        status.Text=$"Borderless · {snapshot.Name} · Native Wall";
    }

    public override void _ExitTree() {stop.Cancel();if(room is not null)_=room.DisposeAsync();}
}
