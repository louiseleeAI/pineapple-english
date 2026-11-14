"""跟读录音质量检查

用法：
  python check_rec.py <录音文件> [--expect 秒数] [--text 目标句子] [--json]

输出：
  1) 容器/编码/采样率/声道/时长/码率  —— 完整性
  2) 峰值、RMS、削波比例、直流偏移、底噪  —— 电平质量
  3) 语音/静音占比、首尾留白           —— 是否真的录到了
  4) 给了 --text 时：ASR 转写并与目标做字级比对
"""
import sys
import os
import json
import argparse

import numpy as np
import av

SR = 16000


def decode(path):
    c = av.open(path)
    st = c.streams.audio[0]
    info = {
        "codec": st.codec_context.name,
        "sample_rate": st.codec_context.sample_rate,
        "channels": st.codec_context.channels,
        "container": c.format.name,
    }
    r = av.AudioResampler(format="s16", layout="mono", rate=SR)
    ch = []
    for fr in c.decode(st):
        for o in r.resample(fr):
            ch.append(o.to_ndarray().reshape(-1))
    c.close()
    if not ch:
        return info, np.zeros(0, dtype=np.float32)
    pcm = np.concatenate(ch).astype(np.float32) / 32768.0
    return info, pcm


def db(x):
    return 20 * np.log10(max(x, 1e-9))


def level_stats(pcm):
    peak = float(np.max(np.abs(pcm))) if pcm.size else 0.0
    rms = float(np.sqrt(np.mean(pcm ** 2))) if pcm.size else 0.0
    clip = float(np.mean(np.abs(pcm) >= 0.999)) if pcm.size else 0.0
    dc = float(np.mean(pcm)) if pcm.size else 0.0
    # 底噪：取帧能量最低的 10%
    hop = int(0.02 * SR)
    frames = [np.sqrt(np.mean(pcm[i:i + hop] ** 2)) for i in range(0, max(1, len(pcm) - hop), hop)]
    frames = np.array(frames) if frames else np.array([0.0])
    noise = float(np.percentile(frames, 10)) if frames.size else 0.0
    speech = float(np.percentile(frames, 90)) if frames.size else 0.0
    return {
        "peak": peak, "peak_db": db(peak), "rms": rms, "rms_db": db(rms),
        "clip_ratio": clip, "dc": dc, "noise": noise, "noise_db": db(noise),
        "snr_db": db(speech) - db(noise) if noise > 0 else 99,
        "frames": frames,
    }


def speech_segments(frames, hop_sec, thr_ratio=0.12):
    """按能量阈值切出有声段；阈值取 (底噪, 语音) 之间的比例"""
    if frames.size == 0:
        return [], 0.0
    lo = np.percentile(frames, 10)
    hi = np.percentile(frames, 90)
    thr = lo + (hi - lo) * thr_ratio if hi > lo else hi * 0.5
    on = frames > max(thr, 0.004)
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if (i - start) * hop_sec >= 0.08:
                segs.append((start * hop_sec, i * hop_sec))
            start = None
    if start is not None:
        segs.append((start * hop_sec, len(on) * hop_sec))
    return segs, float(np.mean(on))


def asr_compare(pcm, target, lang="yue", model_dir=""):
    import sherpa_onnx
    M = model_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)))
    model = os.path.join(M, "model.int8.onnx")
    tokens = os.path.join(M, "tokens.txt")
    if not (os.path.exists(model) and os.path.exists(tokens)):
        return None, "模型不在同目录，跳过识别比对"
    rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=model, tokens=tokens, num_threads=4, use_itn=True, language=lang, debug=False)
    st = rec.create_stream()
    st.accept_waveform(SR, pcm)
    rec.decode_stream(st)
    text = st.result.text
    # 粤语口语字同音异写极多，先归一再比对，否则会把「呀/啊」判成读错
    VARIANTS = {
        "呀": "啊", "吖": "啊", "咗": "左", "嘅": "既", "喺": "系", "係": "系",
        "嗰": "个", "咁": "甘", "噉": "甘", "哋": "地", "冇": "无", "佢": "渠",
        "嚟": "黎", "睇": "体", "俾": "比", "畀": "比", "啲": "的", "咩": "乜",
        "边": "边", "裡": "里", "裏": "里",
    }

    def norm(t):
        out = []
        for ch in t:
            if "\u3400" <= ch <= "\u9fff":
                out.append(VARIANTS.get(ch, ch))
        return "".join(out)

    a, b = norm(text), norm(target)
    # 逐字编辑距离，给出错/漏/多
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
                           dp[i - 1][j - 1] + (0 if a[i - 1] == b[j - 1] else 1))
    dist = dp[n][m]
    hit = max(0, min(n, m) - dist)
    return {
        "heard": text,
        "heard_han": a,
        "target_han": b,
        "distance": dist,
        "match": round(hit / max(1, len(b)), 3),
    }, ""


# ---------------- 声调检查 ----------------
# 只做「同一句内部的一致性」判断：同一个声调的字，音高应当接近。
# 这样不需要任何标准音的绝对音高，也就不会因为男女声、音量不同而误判。
def f0_track(pcm, fmin=70, fmax=400):
    """自相关法逐帧取基频，返回中位 Hz 与起止走向；取不到返回 None"""
    win = int(0.04 * SR)
    hop = int(0.01 * SR)
    lo, hi = int(SR / fmax), int(SR / fmin)
    fs = []
    for i in range(0, len(pcm) - win, hop):
        fr = pcm[i:i + win] * np.hanning(win)
        if np.sqrt(np.mean(fr ** 2)) < 0.01:
            continue
        ac = np.correlate(fr, fr, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        seg = ac[lo:hi]
        if seg.size == 0:
            continue
        k = int(np.argmax(seg)) + lo
        if ac[k] / ac[0] < 0.35:
            continue
        fs.append(SR / k)
    if len(fs) < 4:
        return None
    f = np.array(fs)
    n = len(f)
    core = f[int(n * 0.2):int(n * 0.8) + 1] if n >= 6 else f
    st = np.median(core[:max(2, len(core) // 3)])
    en = np.median(core[-max(2, len(core) // 3):])
    return {"hz": float(np.median(f)), "start": float(st), "end": float(en)}


def semitone(hz, ref):
    if hz <= 0 or ref <= 0:
        return 0.0
    return 12.0 * np.log2(hz / ref)


def merge_short(segs, min_len=0.10, max_gap=0.06):
    """把被切碎的同一音节合回来，丢掉过短的碎片"""
    out = []
    for a, b in segs:
        if out and (a - out[-1][1]) < max_gap and (b - a) < min_len:
            out[-1] = (out[-1][0], b)
        elif (b - a) >= min_len:
            out.append((a, b))
        elif out:
            out[-1] = (out[-1][0], b)
    return out


def tone_report(pcm, segs, jyutping):
    """按音节测基频，检查同调字之间是否一致。

    jyutping 用空格分隔，如 'heoi3 haa6 sing4 jat1 gaan1 caan1 teng1'
    """
    syl = [x for x in jyutping.split() if x]
    if not syl:
        return None
    parts = merge_short(segs)
    aligned = len(parts) == len(syl)
    note = ""
    if not aligned:
        # 没对齐就只报「第几段音高多少」，不声称它对应哪个字，避免张冠李戴
        note = ("切出 %d 段、需要 %d 字，没法逐字对应。下面是每段的音高，"
                "可以自己对着听；想逐字测就一个字一个字分开念。" % (len(parts), len(syl)))
        syl = ["段%d" % (i + 1) for i in range(len(parts))]

    rows = []
    for (a, b), jp in zip(parts, syl):
        f = f0_track(pcm[int(a * SR):int(b * SR)])
        tone = (int(jp[-1]) if jp[-1].isdigit() else 0) if aligned else 0
        rows.append({
            "syl": jp, "tone": tone, "start": round(a, 2), "end": round(b, 2),
            "hz": round(f["hz"], 1) if f else None,
            "start_hz": round(f["start"], 1) if f else None,
            "end_hz": round(f["end"], 1) if f else None,
        })

    meas = [r for r in rows if r["hz"]]
    if len(meas) < 3:
        return {"ok": False, "reason": "可测到基频的音节太少（%d 个），可能音量太轻或噪声太大" % len(meas)}

    ref = float(np.median([r["hz"] for r in meas]))
    for r in meas:
        r["rel"] = round(semitone(r["hz"], ref), 1)

    flags = []
    if not aligned:
        return {"ok": True, "aligned": False, "note": note, "ref_hz": round(ref, 1),
                "syllables": rows, "flags": []}
    # 1) 同一声调的字，音高应当接近
    by_tone = {}
    for r in meas:
        by_tone.setdefault(r["tone"], []).append(r)
    for tone, group in by_tone.items():
        if len(group) < 2:
            continue
        med = float(np.median([r["hz"] for r in group]))
        for r in group:
            d = semitone(r["hz"], med)
            if abs(d) >= 2.5:
                flags.append("「%s」（第%d声）比同声调的其它字%s %.1f 个半音"
                             % (r["syl"], tone, "低" if d < 0 else "高", abs(d)))
    # 2) 第1声（高平）应明显高于第6声（低平）
    t1 = [r["hz"] for r in meas if r["tone"] == 1]
    t6 = [r["hz"] for r in meas if r["tone"] == 6]
    if t1 and t6:
        d = semitone(float(np.median(t1)), float(np.median(t6)))
        if d < 1.5:
            flags.append("第1声只比第6声高 %.1f 个半音，两声区分不开（正常应差 4 个半音以上）" % d)

    return {"ok": True, "aligned": aligned, "note": note, "ref_hz": round(ref, 1),
            "syllables": rows, "flags": flags}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--expect", type=float, default=0.0, help="这句原声的时长（秒）")
    ap.add_argument("--text", default="", help="目标句子，用于识别比对")
    ap.add_argument("--jyutping", default="", help="逐字粤拼，空格分隔，用于检查声调一致性")
    ap.add_argument("--lang", default="yue", choices=["yue", "zh", "en"], help="识别语言（默认 yue）")
    ap.add_argument("--model-dir", default="", help="模型所在目录；不给就用本脚本所在目录")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    if not os.path.exists(a.audio):
        print("找不到文件：" + a.audio)
        return 2
    size = os.path.getsize(a.audio)
    info, pcm = decode(a.audio)
    dur = pcm.size / SR
    lv = level_stats(pcm)
    hop = 0.02
    segs, speech_ratio = speech_segments(lv["frames"], hop)

    problems = []
    if size < 2000:
        problems.append("文件过小（%d 字节），基本可以断定没录到内容" % size)
    if info["sample_rate"] and info["sample_rate"] < 16000:
        problems.append("采样率只有 %d Hz，建议 44.1k/48k" % info["sample_rate"])
    if lv["clip_ratio"] > 0.001:
        problems.append("削波：%.2f%% 的采样贴顶，声音会破" % (lv["clip_ratio"] * 100))
    if lv["peak_db"] < -30:
        problems.append("音量太小：峰值仅 %.1f dBFS" % lv["peak_db"])
    if lv["rms_db"] < -38:
        problems.append("整体过轻：RMS %.1f dBFS" % lv["rms_db"])
    if abs(lv["dc"]) > 0.02:
        problems.append("直流偏移 %.3f，可能有电流声" % lv["dc"])
    if lv["snr_db"] < 12 and lv["noise"] > 0:
        problems.append("信噪比偏低（%.1f dB），底噪明显" % lv["snr_db"])
    if speech_ratio < 0.25 and dur > 1:
        problems.append("有声音的部分只占 %.0f%%，大部分是空白" % (speech_ratio * 100))
    if segs:
        lead = segs[0][0]
        tail = max(0.0, dur - segs[-1][1])
        if lead > 1.2:
            problems.append("开头有 %.1f 秒空白才开口" % lead)
        if tail > 1.5:
            problems.append("结尾有 %.1f 秒空白" % tail)
    if a.expect and dur > 0:
        ratio = dur / a.expect
        if ratio < 0.6:
            problems.append("时长只有原句的 %.0f%%，可能没录全" % (ratio * 100))
        elif ratio > 2.2:
            problems.append("时长是原句的 %.1f 倍，可能拖太长或录进了杂音" % ratio)

    out = {
        "file": a.audio,
        "bytes": size,
        "kb_per_sec": round(size / max(dur, 0.01) / 1024, 1),
        "duration": round(dur, 2),
        "container": info["container"],
        "codec": info["codec"],
        "sample_rate": info["sample_rate"],
        "channels": info["channels"],
        "peak_db": round(lv["peak_db"], 1),
        "rms_db": round(lv["rms_db"], 1),
        "clip_pct": round(lv["clip_ratio"] * 100, 3),
        "dc": round(lv["dc"], 4),
        "snr_db": round(lv["snr_db"], 1) if lv["snr_db"] < 90 else None,
        "speech_pct": round(speech_ratio * 100, 1),
        "segments": [(round(x, 2), round(y, 2)) for x, y in segs[:12]],
        "problems": problems,
    }
    if a.jyutping:
        out["tones"] = tone_report(pcm, segs, a.jyutping)

    if a.text:
        cmp, err = asr_compare(pcm, a.text, a.lang, a.model_dir)
        if cmp:
            out["asr"] = cmp
        elif err:
            out["asr_error"] = err

    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    print("=" * 56)
    print("文件：%s" % os.path.basename(a.audio))
    print("格式：%s / %s / %d Hz / %d 声道 / %.2f 秒 / %.0f KB（%.1f KB/s）"
          % (info["container"], info["codec"], info["sample_rate"] or 0,
             info["channels"] or 0, dur, size / 1024, size / max(dur, 0.01) / 1024))
    print("电平：峰值 %.1f dBFS / RMS %.1f dBFS / 削波 %.3f%% / 直流 %.4f"
          % (lv["peak_db"], lv["rms_db"], lv["clip_ratio"] * 100, lv["dc"]))
    if lv["snr_db"] < 90:
        print("信噪：约 %.1f dB（底噪 %.1f dBFS）" % (lv["snr_db"], lv["noise_db"]))
    print("语音：占比 %.0f%%，共 %d 段" % (speech_ratio * 100, len(segs)))
    if out["segments"]:
        print("      " + " ".join("%.2f-%.2f" % s for s in out["segments"][:8]))
    if out.get("tones"):
        t = out["tones"]
        print("声调：")
        if not t.get("ok"):
            print("      " + t.get("reason", ""))
        else:
            print("      音节      声调  音高      相对整句")
            for r in t["syllables"]:
                if r.get("hz"):
                    lab = str(r["tone"]) if r["tone"] else "-"
                    print("      %-9s %-4s %6.1f Hz  %+5.1f 半音"
                          % (r["syl"], lab, r["hz"], r.get("rel", 0)))
                else:
                    print("      %-9s %d    （测不到）" % (r["syl"], r["tone"]))
            print("      整句中位音高 %.1f Hz" % t["ref_hz"])
            if t.get("note"):
                print("      注：" + t["note"])

    if "asr" in out:
        r = out["asr"]
        print("识别：%s" % r["heard"])
        print("目标：%s" % a.text)
        print("字级：%d 个字对 %d 个，匹配率 %.0f%%"
              % (len(r["heard_han"]) - r["distance"] if r["distance"] <= len(r["heard_han"]) else 0,
                 len(r["target_han"]), r["match"] * 100))
    tone_flags = (out.get("tones") or {}).get("flags") or []
    if tone_flags:
        print("声调提示（只作定位，不作评分）：")
        for x in tone_flags:
            print("  ~ " + x)

    print("-" * 56)
    if problems:
        print("发现 %d 个问题：" % len(problems))
        for x in problems:
            print("  ! " + x)
    else:
        print("未发现明显问题。")
    print("=" * 56)
    return 0


if __name__ == "__main__":
    sys.exit(main())
