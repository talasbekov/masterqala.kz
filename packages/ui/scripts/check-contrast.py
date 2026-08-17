#!/usr/bin/env python3
"""Проверка контраста дизайн-токенов MasterQala.kz.

Читает packages/ui/src/tokens.css и проверяет каждую пару «текст/фон» и
«граница/фон», которая реально встречается в интерфейсе, против порогов WCAG 2.2:
  - текст            >= 4.5:1  (1.4.3 AA)
  - границы контролов >= 3.0:1  (1.4.11 AA, non-text contrast)

Запуск:  python3 packages/ui/scripts/check-contrast.py
Выход:   0 — все пары проходят, 1 — есть провалы (пригодно для CI).

Зачем файлом, а не разово: предыдущая палитра проваливала AA в четырёх местах
(placeholder 2.44:1, границы полей 1.51:1, белый на success 3.77:1,
вторичный текст 4.19:1) — глазами это не видно, только счётом.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TOKENS = Path(__file__).resolve().parent.parent / "src" / "tokens.css"

TEXT_MIN = 4.5
UI_MIN = 3.0

# Поверхности, на которых может оказаться текст. Проверяем на самой тёмной из
# них тоже — иначе токен проходит на белом и проваливается на surface-sunken.
SURFACES = ("background", "surface", "surface-sunken")


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    channels = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    r, g, b = linear
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def load_tokens() -> dict[str, str]:
    src = TOKENS.read_text(encoding="utf-8")
    return dict(re.findall(r"--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})", src))


def build_checks() -> list[tuple[str, str, float]]:
    """(foreground, background, minimum) для каждой реальной пары."""
    checks: list[tuple[str, str, float]] = []

    # Текст поверх всех базовых поверхностей.
    for token in ("ink", "ink-soft", "ink-muted", "primary", "urgent", "success", "danger", "warning"):
        for surface in SURFACES:
            checks.append((token, surface, TEXT_MIN))

    # Контрастный текст поверх плотных заливок (кнопки, бейджи).
    for on, fill in (
        ("on-primary", "primary"),
        ("on-urgent", "urgent"),
        ("on-success", "success"),
        ("on-danger", "danger"),
        ("on-warning", "warning"),
    ):
        checks.append((on, fill, TEXT_MIN))

    # Текст поверх мягких подложек.
    for ink, soft in (
        ("primary-ink", "primary-soft"),
        ("urgent-ink", "urgent-soft"),
        ("success-ink", "success-soft"),
        ("danger-ink", "danger-soft"),
        ("warning-ink", "warning-soft"),
        ("on-fill", "fill"),
        ("on-fill", "fill-soft"),
    ):
        checks.append((ink, soft, TEXT_MIN))

    # Границы интерактивных контролов и обводка фокуса — 3:1.
    for surface in SURFACES:
        checks.append(("border-strong", surface, UI_MIN))
        checks.append(("focus-ring", surface, UI_MIN))
    # Обводка фокуса внутри primary-кнопки видна через белый offset.
    checks.append(("on-primary", "primary", UI_MIN))

    return checks


def main() -> int:
    tokens = load_tokens()
    failures: list[str] = []
    missing: list[str] = []

    for fg, bg, minimum in build_checks():
        if fg not in tokens or bg not in tokens:
            missing.append(f"--color-{fg} / --color-{bg}")
            continue
        r = ratio(tokens[fg], tokens[bg])
        if r < minimum:
            failures.append(f"{fg} на {bg}: {r:.2f}:1 < {minimum}:1")

    checked = len(build_checks()) - len(missing)
    if missing:
        print("Нет таких токенов:")
        for m in sorted(set(missing)):
            print(f"  ? {m}")
    if failures:
        print(f"Провалы контраста ({len(failures)} из {checked} пар):")
        for f in failures:
            print(f"  ✗ {f}")
        print("\nПоправьте значение в packages/ui/src/tokens.css и запустите снова.")
        return 1

    print(f"Контраст: все {checked} пар проходят WCAG AA "
          f"(текст >= {TEXT_MIN}:1, границы >= {UI_MIN}:1).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
