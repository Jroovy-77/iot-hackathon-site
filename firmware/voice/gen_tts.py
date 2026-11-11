"""สร้างเสียงพูด 13 ประโยคด้วย Microsoft Edge TTS (ต้องมีเน็ต) → voice/src/<voice>/<id>.mp3
usage: python gen_tts.py [th-TH-PremwadeeNeural|th-TH-NiwatNeural] [rate]"""
import asyncio, sys, pathlib
import edge_tts
voice = sys.argv[1] if len(sys.argv) > 1 else "th-TH-PremwadeeNeural"
rate = sys.argv[2] if len(sys.argv) > 2 else "-10%"
out = pathlib.Path(__file__).parent / "src" / voice.split("-")[-1].replace("Neural", "").lower()
out.mkdir(parents=True, exist_ok=True)
async def main():
    for line in open(pathlib.Path(__file__).parent / "phrases.txt", encoding="utf-8"):
        pid, text = line.strip().split("|", 1)
        if (out / f"{pid}.mp3").exists(): continue
        await edge_tts.Communicate(text, voice, rate=rate).save(str(out / f"{pid}.mp3"))
        print(pid, "ok")
asyncio.run(main())
