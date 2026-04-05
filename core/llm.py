"""LLM loader and generation helper for Gemma 4 via HuggingFace Transformers."""
from __future__ import annotations

import os
import threading

import torch
from transformers import AutoModelForCausalLM, AutoProcessor

DEFAULT_MODEL_ID = os.environ.get("GEMMA_MODEL_ID", "google/gemma-4-E4B-it")

_lock = threading.Lock()
_processor = None
_model = None


def load_model() -> tuple:
    """Lazy-load Gemma 4 model & processor (singleton)."""
    global _processor, _model
    with _lock:
        if _model is None:
            _processor = AutoProcessor.from_pretrained(
                DEFAULT_MODEL_ID, trust_remote_code=False
            )
            _model = AutoModelForCausalLM.from_pretrained(
                DEFAULT_MODEL_ID,
                dtype="auto",
                device_map="auto",
                trust_remote_code=False,
            )
            _model.eval()
    return _processor, _model


def generate(
    system: str,
    user: str,
    max_new_tokens: int = 512,
    temperature: float = 1.0,
) -> str:
    """Run a single-turn chat completion and return the assistant text."""
    max_new_tokens = max(16, min(int(max_new_tokens), 2048))
    temperature = max(0.0, min(float(temperature), 2.0))

    processor, model = load_model()

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    text = processor.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
        enable_thinking=False,
    )
    inputs = processor(text=text, return_tensors="pt").to(model.device)
    input_len = inputs["input_ids"].shape[-1]

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0.0,
            temperature=temperature if temperature > 0.0 else 1.0,
            top_p=0.95,
            top_k=64,
        )

    raw = processor.decode(outputs[0][input_len:], skip_special_tokens=False)
    parsed = processor.parse_response(raw)
    if isinstance(parsed, dict):
        return str(parsed.get("content", "")).strip()
    return str(parsed).strip()
