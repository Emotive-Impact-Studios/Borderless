using System.Runtime.InteropServices;

namespace Borderless.Native;

public enum CaptureHealth : uint { Stopped, Starting, Receiving, Stale, Invalid }

[StructLayout(LayoutKind.Sequential)]
public struct DisplayPoint { public double X; public double Y; public uint Valid; }

public static class NativeCore
{
    [DllImport("borderless_core", CallingConvention = CallingConvention.Cdecl)]
    private static extern uint bl_core_abi_version();
    [DllImport("borderless_core", CallingConvention = CallingConvention.Cdecl)]
    private static extern uint bl_capture_status(uint active, ulong started, ulong last, ulong frames, ulong now, ulong timeout);
    [DllImport("borderless_core", CallingConvention = CallingConvention.Cdecl)]
    private static extern DisplayPoint bl_display_uv(double x, double y, double width, double height, double px, double py, uint rotation);

    public static void CheckVersion()
    {
        if (bl_core_abi_version() != 1) throw new NotSupportedException("Borderless core ABI must be 1.");
    }
    public static CaptureHealth Health(bool active, ulong started, ulong last, ulong frames, ulong now, ulong timeout = 10_000)
    {
        CheckVersion();
        return (CaptureHealth)bl_capture_status(active ? 1u : 0u, started, last, frames, now, timeout);
    }
    public static DisplayPoint MapDisplay(double x, double y, double width, double height, double px, double py, uint rotation)
    {
        CheckVersion();
        return bl_display_uv(x, y, width, height, px, py, rotation);
    }
}
