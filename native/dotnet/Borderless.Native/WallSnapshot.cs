using System.Text.Json;

namespace Borderless.Native;

public sealed record WallSurface(string Id, string Title, string Owner, string Content, float X, float Y, float Width, float Height);
public sealed record WallSnapshot(string Name, IReadOnlyList<WallSurface> Surfaces)
{
    // Validate the complete snapshot before mutating any visible scene nodes.
    public static WallSnapshot Parse(string json)
    {
        using var document=RoomClient.DecodeSnapshot(System.Text.Encoding.UTF8.GetBytes(json));
        var root=document.RootElement;
        var name=Text(root,"name",80);
        var items=root.GetProperty("items");
        if(items.ValueKind!=JsonValueKind.Array || items.GetArrayLength()>60)throw new InvalidDataException("Item limit");
        var ids=new HashSet<string>();
        var surfaces=new List<WallSurface>();
        foreach(var item in items.EnumerateArray()) {
            var id=Text(item,"id",64);
            if(id.Length==0 || !ids.Add(id))throw new InvalidDataException("Duplicate or empty surface ID");
            var bounds=new[]{"x","y","w","h"}.Select(k=>item.GetProperty(k).GetSingle()).ToArray();
            if(bounds.Any(x=>!float.IsFinite(x)||x<0||x>1) || bounds[2]<=0 || bounds[3]<=0)
                throw new InvalidDataException("Invalid surface geometry");
            var title=Text(item,"title",240);var owner=Text(item,"ownerName",80);
            var kind=Text(item,"kind",16);
            var content=kind=="note" ? Text(item,"text",8000) : "Native file viewer not yet implemented";
            surfaces.Add(new(id,title,owner,content,bounds[0],bounds[1],bounds[2],bounds[3]));
        }
        return new(name,surfaces);
    }
    private static string Text(JsonElement parent,string key,int maximum)
    {
        var value=parent.GetProperty(key);
        if(value.ValueKind!=JsonValueKind.String)throw new InvalidDataException($"Invalid {key}");
        var text=value.GetString()!;
        if(text.Length>maximum)throw new InvalidDataException($"Oversized {key}");
        return text;
    }
}
