"""Assemble frames + narration from record.mjs into an MP4 with soft Norwegian subtitles.

Usage: python3 build.py <scenario-name> [output.mp4]
Reads out/<scenario-name>/ (or DEMO_WORK_DIR); default output out/<name>/<name>.mp4 plus .srt.
"""
import json
import os
import subprocess
import sys

base = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1] if len(sys.argv) > 1 else "intro"
here = os.path.abspath(os.environ.get("DEMO_WORK_DIR") or os.path.join(base, "out", name))
out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(here, f"{name}.mp4")
tl = json.load(open(os.path.join(here, "timeline.json")))
frames, scenes, t0, t_end = tl["frames"], tl["scenes"], tl["frames"][0]["t"], tl["tEnd"]

# Frame list with per-frame durations (screencast only emits on change).
with open(os.path.join(here, "frames.txt"), "w") as f:
    for i, fr in enumerate(frames):
        nxt = frames[i + 1]["t"] if i + 1 < len(frames) else t_end
        f.write(f"file '{fr['f']}'\nduration {max(nxt - fr['t'], 0.001):.4f}\n")
    f.write(f"file '{frames[-1]['f']}'\n")


def ts(sec):
    ms = int(round(sec * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


srt = os.path.splitext(out)[0] + ".srt"
with open(srt, "w") as f:
    n = 0
    for i, s in enumerate(scenes):
        if not s["text"]:
            continue
        n += 1
        a = s["start"] - t0
        b = (scenes[i + 1]["start"] - t0) if i + 1 < len(scenes) else a + s["dur"] + 1
        f.write(f"{n}\n{ts(a)} --> {ts(b - 0.05)}\n{s['text']}\n\n")

cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
       "-f", "concat", "-safe", "0", "-i", os.path.join(here, "frames.txt")]
for s in scenes:
    cmd += ["-i", s["file"]]
cmd += ["-i", srt]
parts = []
for i, s in enumerate(scenes):
    d = max(int((s["start"] - t0) * 1000), 0)
    parts.append(f"[{i + 1}:a]aresample=48000,adelay={d}|{d}[a{i}]")
mix = "".join(f"[a{i}]" for i in range(len(scenes)))
fc = "[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,tpad=stop_mode=clone:stop_duration=5[vout];" + ";".join(parts) + f";{mix}amix=inputs={len(scenes)}:normalize=0,apad[aout]"
cmd += ["-filter_complex", fc,
        "-map", "[vout]", "-map", "[aout]", "-map", f"{len(scenes) + 1}:s",
        "-c:v", "libx264", "-preset", "slow", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k", "-c:s", "mov_text", "-metadata:s:s:0", "language=" + ("eng" if tl.get("lang") == "en" else "nor"),
        "-t", f"{t_end - t0:.2f}", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
print(out)
