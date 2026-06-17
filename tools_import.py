#!/usr/bin/env python3
"""
Импорт результатов теста Тулс из PDF-файлов в Supabase.

Использование:
  pip install pdfplumber supabase
  python tools_import.py <папка_с_pdf>

Пример:
  python tools_import.py "/Users/skillboxkrasnoyars/Desktop/Тесты /HR scaner варианты ответов на тест тулс"
"""

import sys
import os
import re
import json
import pdfplumber
from datetime import datetime

# ─── Настройки Supabase ───────────────────────────────────────
SUPABASE_URL = "https://pnoislxcidkfhnkpawpj.supabase.co"
SUPABASE_KEY = "sb_publishable_EO1zOLoyX15U3fpWncVMJw_u7y0_1sF"

INDICATORS = {
    'А': 'Внимательность', 'В': 'Позитивность', 'С': 'Самообладание',
    'D': 'Уверенность', 'Е': 'Активность', 'F': 'Настойчивость',
    'G': 'Ответственность', 'Н': 'Объективность', 'I': 'Чуткость', 'J': 'Общительность'
}
INDICATOR_NAMES = list(INDICATORS.values())


def extract_columns(page):
    """Разбивает страницу на левую и правую колонку по ширине."""
    mid = page.width / 2
    left  = page.within_bbox((0, 0, mid, page.height)).extract_text() or ""
    right = page.within_bbox((mid, 0, page.width, page.height)).extract_text() or ""
    return left, right


def parse_pdf(path):
    with pdfplumber.open(path) as pdf:
        page1_text = pdf.pages[0].extract_text() or ""
        all_text   = "\n".join(p.extract_text() or "" for p in pdf.pages)

    # Имя кандидата
    m = re.search(r'«Тулс» — (.+)', page1_text)
    candidate_name = m.group(1).strip() if m else os.path.basename(path)

    # Возраст
    age_m = re.search(r'(\d{1,2})\s+лет', page1_text)
    candidate_age = int(age_m.group(1)) if age_m else None

    # Кол-во ответов
    ans_m = re.search(r'Ответы (\d+) из (\d+)', page1_text)
    answers_count   = int(ans_m.group(1)) if ans_m else None
    total_questions = int(ans_m.group(2)) if ans_m else 200

    # Баллы: ищем «ИмяПоказателя\n<число>» на первой странице
    lines = page1_text.split('\n')
    scores = {}
    for i, line in enumerate(lines):
        for name in INDICATOR_NAMES:
            if line.strip() == name:
                for j in range(i + 1, min(i + 5, len(lines))):
                    sl = lines[j].strip()
                    if re.match(r'^-?\d+$', sl):
                        scores[name] = int(sl)
                        break
    # Запасной вариант
    for name in INDICATOR_NAMES:
        if name not in scores:
            mm = re.search(rf'{re.escape(name)}\n(-?\d+)', page1_text)
            if mm:
                scores[name] = int(mm.group(1))

    # Синдромы
    syn_m = re.search(r'Синдромы и перевесы\n([\s\S]+?)(?=Объяснение результатов|\Z)', all_text)
    syndromes = []
    if syn_m:
        raw = syn_m.group(1).strip()
        for ln in raw.split('\n'):
            ln = ln.strip()
            if ln and len(ln) < 45 and not ln.endswith('.') and not any(
                ln.startswith(w) for w in ('Человек', 'Своими', 'Старается', 'Имеет', 'Это')
            ):
                syndromes.append(ln)

    return {
        "candidate_name": candidate_name,
        "candidate_age":  candidate_age,
        "scores":         scores,
        "answers_count":  answers_count,
        "total_questions":total_questions,
        "syndromes":      syndromes,
    }


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    files  = sorted(f for f in os.listdir(folder) if f.lower().endswith('.pdf'))
    if not files:
        print("Нет PDF файлов в папке:", folder)
        return

    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    except ImportError:
        print("Установите: pip install supabase")
        return

    ok = err = 0
    for fname in files:
        path = os.path.join(folder, fname)
        try:
            rec = parse_pdf(path)
            if not rec["scores"]:
                print(f"  ⚠ {fname}: баллы не найдены, пропускаем")
                continue

            result = sb.table("tools_results").insert({
                "candidate_name":  rec["candidate_name"],
                "candidate_age":   rec["candidate_age"],
                "scores":          rec["scores"],
                "answers_count":   rec["answers_count"],
                "total_questions": rec["total_questions"],
                "syndromes":       rec["syndromes"],
            }).execute()

            if result.data:
                print(f"  ✓ {rec['candidate_name']}")
                ok += 1
            else:
                print(f"  ✗ {fname}: {result}")
                err += 1
        except Exception as e:
            print(f"  ✗ {fname}: {e}")
            err += 1

    print(f"\nГотово: {ok} импортировано, {err} ошибок")


if __name__ == "__main__":
    main()
