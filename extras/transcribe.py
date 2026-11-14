"""
English Reader — 本地转写脚本（faster-whisper）

用法:
    python transcribe.py <音频路径> <输出SRT路径> <模型目录> [线程数]

输出:
    stdout 每行 PROGRESS <0-100> 表示进度，最后输出 DONE <句数>
    失败时 stderr 输出错误并返回非 0
"""
import sys
import os
import time

def fmt_ts(sec):
    if sec < 0:
        sec = 0
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)

def main():
    if len(sys.argv) < 4:
        sys.stderr.write("usage: transcribe.py <audio> <out.srt> <model_dir> [threads]\n")
        return 2

    audio = sys.argv[1]
    out_srt = sys.argv[2]
    model_dir = sys.argv[3]
    threads = int(sys.argv[4]) if len(sys.argv) > 4 else 8

    if not os.path.exists(audio):
        sys.stderr.write("audio not found: %s\n" % audio)
        return 3
    if not os.path.isdir(model_dir):
        sys.stderr.write("model dir not found: %s\n" % model_dir)
        return 4

    # 离线模式：禁止联网找模型
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    from faster_whisper import WhisperModel

    t0 = time.time()
    model = WhisperModel(
        model_dir,
        device="cpu",
        compute_type="int8",
        cpu_threads=threads,
        num_workers=1,
    )
    segments, info = model.transcribe(
        audio,
        language="en",
        beam_size=1,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        condition_on_previous_text=False,
    )

    total = float(getattr(info, "duration", 0) or 0)
    sys.stdout.write("TOTAL %.2f\n" % total)
    sys.stdout.flush()

    lines = []
    n = 0
    last_pct = -1
    for seg in segments:
        n += 1
        text = (seg.text or "").strip()
        if text:
            lines.append(
                "%d\n%s --> %s\n%s\n" % (n, fmt_ts(seg.start), fmt_ts(seg.end), text)
            )
        if total > 0:
            pct = min(99, int(seg.end / total * 100))
            if pct != last_pct:
                last_pct = pct
                sys.stdout.write("PROGRESS %d\n" % pct)
                sys.stdout.flush()

    with open(out_srt, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    sys.stdout.write("PROGRESS 100\n")
    sys.stdout.write("DONE %d %.1f\n" % (len(lines), time.time() - t0))
    sys.stdout.flush()
    return 0

if __name__ == "__main__":
    sys.exit(main())
