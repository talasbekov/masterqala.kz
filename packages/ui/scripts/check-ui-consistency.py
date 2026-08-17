#!/usr/bin/env python3
"""Проверка соблюдения дизайн-системы в коде приложений.

Ловит ровно те дефекты, из-за которых затевался редизайн 17.08.2026, — чтобы
они не вернулись по одному. Каждое правило здесь появилось потому, что
нарушение уже было в проде и его никто не заметил.

Запуск:  python3 packages/ui/scripts/check-ui-consistency.py
Выход:   0 — чисто, 1 — есть нарушения (пригодно для CI).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
APPS = ["client", "master", "operator", "site", "web"]

# Диапазоны эмодзи + типографские глифы, которыми подменяли иконки.
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF☀-➿⬀-⯿]"
)

RULES: list[tuple[str, re.Pattern[str], str]] = [
    (
        "эмодзи вместо иконки",
        EMOJI,
        "Возьмите SVG из @masterqala/ui. Эмодзи по-разному рисуются на разных "
        "ОС, не наследуют цвет и озвучиваются не тем, что значат.",
    ),
    (
        "outline-none без замены",
        re.compile(r"\boutline-none\b"),
        "Не убирайте обводку фокуса. Глобальное правило :focus-visible в "
        "base.css уже даёт кольцо 3px — класс не нужен.",
    ),
    (
        "произвольный кегль text-[Npx]",
        re.compile(r"text-\[\d+(?:\.\d+)?px\]"),
        "Используйте шкалу: text-2xs (12px, низ) / xs / sm / base / lg / xl…",
    ),
    (
        "устаревший токен",
        re.compile(r"\b(?:text|bg|border|placeholder:text)-(?:muted|danger-bg|success-bg|warning-bg)\b"),
        "Токены переименованы: muted → ink-muted, *-bg → *-soft.",
    ),
    (
        "цвет мимо токенов",
        re.compile(r"#(?:166088|134F73|14303C|5B7B8A|8FAAB8|C0D6DF|CFE0E8|059669|0f766e)\b", re.I),
        "Это цвета старой палитры. Используйте var(--color-*) из tokens.css.",
    ),
]


# .ts и .json проверяются наравне с .tsx намеренно: эмодзи прятались не только
# в разметке. Они жили в categoryMeta.ts (иконки категорий строками) и прямо в
# значениях ru.json — то есть в местах, куда grep по '*.tsx' никогда не заглянет.
EXTENSIONS = ("*.tsx", "*.ts", "*.json")
SKIP_DIRS = {"node_modules", ".next", "dist", "build", ".turbo"}


def source_files() -> list[Path]:
    files: list[Path] = []
    for app in APPS:
        base = ROOT / "apps" / app
        if not base.exists():
            continue
        for ext in EXTENSIONS:
            for path in base.rglob(ext):
                if SKIP_DIRS & set(path.parts):
                    continue
                files.append(path)
    return files


def main() -> int:
    files = source_files()
    if not files:
        print("Не найдено ни одного .tsx — проверьте путь запуска.")
        return 1

    violations: dict[str, list[str]] = {}
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for line_no, line in enumerate(text.splitlines(), 1):
            for name, pattern, _hint in RULES:
                if pattern.search(line):
                    rel = path.relative_to(ROOT)
                    violations.setdefault(name, []).append(
                        f"{rel}:{line_no}: {line.strip()[:100]}"
                    )

    if not violations:
        print(f"Дизайн-система: нарушений нет ({len(files)} файлов проверено).")
        return 0

    total = sum(len(v) for v in violations.values())
    print(f"Нарушения дизайн-системы: {total} в {len(files)} файлах\n")
    hints = {name: hint for name, _p, hint in RULES}
    for name, items in violations.items():
        print(f"■ {name} — {len(items)}")
        print(f"  {hints[name]}")
        for item in items[:8]:
            print(f"    {item}")
        if len(items) > 8:
            print(f"    …и ещё {len(items) - 8}")
        print()
    return 1


if __name__ == "__main__":
    sys.exit(main())
