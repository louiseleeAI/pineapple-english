"""跟读评分用的常驻识别服务（英语）

用法：
  python shadow_server.py <模型目录> [线程数]

协议：stdin 每行一个音频文件路径，stdout 每行一个 JSON。
  {"ok": true, "ready": true}      模型加载完，可以喂路径
  {"ok": true, "text": "..."}      识别结果
  {"ok": false, "err": "..."}      这一条失败（进程继续）

常驻的意义：faster-whisper 每次冷启动要重新加载模型（这台机器约 10 秒），
一句 2 秒的录音根本不值得。常驻之后每句只要 1–3 秒。
"""
import sys
import os
import json

# 这台机器内存紧张，OpenBLAS 按线程数预分配缓冲会直接把模型加载搞崩
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")


def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    if len(sys.argv) < 2:
        emit({"ok": False, "err": "缺少模型目录参数"})
        return 2
    model_dir = sys.argv[1]
    threads = int(sys.argv[2]) if len(sys.argv) > 2 else 4

    try:
        from faster_whisper import WhisperModel
    except Exception as e:
        emit({"ok": False, "err": "import faster_whisper 失败: %s" % e})
        return 3

    try:
        model = WhisperModel(model_dir, device="cpu", compute_type="int8", cpu_threads=threads)
    except Exception as e:
        emit({"ok": False, "err": "加载模型失败: %s" % e})
        return 4

    emit({"ok": True, "ready": True})

    for line in sys.stdin:
        path = line.strip()
        if not path:
            continue
        if path == "__QUIT__":
            break
        try:
            segments, _info = model.transcribe(
                path,
                language="en",
                beam_size=1,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            text = " ".join(s.text.strip() for s in segments).strip()
            emit({"ok": True, "text": text})
        except Exception as e:
            emit({"ok": False, "err": str(e)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
