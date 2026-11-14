"""Intelligent provider routing for media generation.

All routing is env-driven: provider chain order AND model names from .env.
Default fallback chain: Gemini → MiniMax → OpenRouter (varies by task).
"""

import sys
from pathlib import Path
from typing import Dict, Any, Optional, List

sys.path.insert(0, str(Path(__file__).parent))
from env_utils import _env

DEFAULT_CHAINS = {
    'generate-image': ['gemini', 'minimax', 'openrouter'],
    'generate-video': ['gemini', 'minimax'],
    'generate-speech': ['minimax'],
    'generate-music': ['minimax'],
}

PROVIDER_KEY_MAP = {
    'gemini': 'GEMINI_API_KEY',
    'minimax': 'MINIMAX_API_KEY',
    'openrouter': 'OPENROUTER_API_KEY',
}

CHAIN_ENV_MAP = {
    'generate-image': 'IMAGE_PROVIDER_CHAIN',
    'generate-video': 'VIDEO_PROVIDER_CHAIN',
    'generate-speech': 'SPEECH_PROVIDER_CHAIN',
    'generate-music': 'MUSIC_PROVIDER_CHAIN',
}

MODEL_ENV_MAP = {
    ('gemini', 'generate-image'): ('IMAGE_GEN_MODEL', 'gemini-3.1-flash-image-preview'),
    ('gemini', 'generate-video'): ('VIDEO_GEN_MODEL', 'veo-3.1-generate-preview'),
    ('minimax', 'generate-image'): ('MINIMAX_IMAGE_MODEL', 'image-01'),
    ('minimax', 'generate-video'): ('MINIMAX_VIDEO_MODEL', 'MiniMax-Hailuo-2.3'),
    ('minimax', 'generate-speech'): ('MINIMAX_SPEECH_MODEL', 'speech-2.8-hd'),
    ('minimax', 'generate-music'): ('MINIMAX_MUSIC_MODEL', 'music-2.6'),
    ('openrouter', 'generate-image'): ('OPENROUTER_IMAGE_MODEL', 'black-forest-labs/flux-1-schnell'),
}


def get_model_for(provider: str, task: str) -> str:
    """Get model name from env or default."""
    entry = MODEL_ENV_MAP.get((provider, task))
    if not entry:
        return ''
    env_var, default = entry
    return _env(env_var) or default


def get_chain(task: str) -> List[str]:
    """Get provider chain from env or default."""
    env_var = CHAIN_ENV_MAP.get(task)
    if env_var:
        chain_str = _env(env_var)
        if chain_str:
            return [p.strip() for p in chain_str.split(',') if p.strip()]
    return DEFAULT_CHAINS.get(task, [])


def get_available_providers(task: str) -> List[str]:
    """Return ordered list of available providers for a task."""
    chain = get_chain(task)
    available = []
    for provider in chain:
        if provider not in PROVIDER_KEY_MAP:
            print(f"[router] WARNING: unknown provider '{provider}' in chain, skipping",
                  file=sys.stderr)
            continue
        env_var = PROVIDER_KEY_MAP[provider]
        if _env(env_var):
            if provider == 'openrouter' and (_env('OPENROUTER_FALLBACK_ENABLED') or '').lower() != 'true':
                continue
            available.append(provider)
    return available


def route_generation(task: str, force_provider: Optional[str] = None,
                     verbose: bool = False, **kwargs) -> Dict[str, Any]:
    """Route generation to best available provider with fallback."""
    if task not in DEFAULT_CHAINS:
        return {'status': 'error',
                'error': f'Unknown task: {task}. Supported: {list(DEFAULT_CHAINS.keys())}'}

    if force_provider:
        providers = [force_provider] if _env(PROVIDER_KEY_MAP.get(force_provider, '')) else []
        if not providers:
            return {'status': 'error',
                    'error': f'Provider {force_provider} not available (key not set)'}
    else:
        providers = get_available_providers(task)

    if not providers:
        needed = [f'MEOWKIT_{PROVIDER_KEY_MAP[p]}' for p in DEFAULT_CHAINS.get(task, [])]
        return {'status': 'error',
                'error': f'No provider available for {task}. Set one of: {", ".join(needed)}'}

    last_error = None
    for provider in providers:
        if verbose:
            print(f"[router] Trying {provider} for {task}...", file=sys.stderr)
        try:
            result = _call_provider(provider, task, verbose=verbose, **kwargs)
            if result.get('status') == 'success':
                return result
            last_error = result.get('error', 'Unknown error')
        except Exception as e:
            last_error = str(e)
            if verbose:
                print(f"[router] {provider} failed: {last_error}", file=sys.stderr)
    return {'status': 'error', 'error': f'All providers failed. Last: {last_error}'}


def _call_provider(provider: str, task: str, **kwargs) -> Dict[str, Any]:
    """Dispatch to provider-specific function."""
    if provider == 'gemini':
        return _call_gemini(task, **kwargs)
    elif provider == 'minimax':
        return _call_minimax(task, **kwargs)
    elif provider == 'openrouter':
        return _call_openrouter(task, **kwargs)
    return {'status': 'error', 'error': f'Unknown provider: {provider}'}


def _call_gemini(task, prompt='', output_dir='./output', verbose=False, **kw):
    model = kw.get('model') or get_model_for('gemini', task)
    if task == 'generate-image':
        from gemini_generate import generate_image
        return generate_image(prompt, model=model, output_dir=output_dir, verbose=verbose)
    elif task == 'generate-video':
        from video_generator import generate_video
        return generate_video(prompt, model=model, output_dir=output_dir, verbose=verbose)
    return {'status': 'error', 'error': f'Gemini does not support {task}'}


def _call_minimax(task, prompt='', text='', lyrics='', output_dir='./output',
                  verbose=False, **kw):
    from minimax_generate import (generate_image as mm_image, generate_video as mm_video,
                                   generate_speech, generate_music)
    model = kw.get('model') or get_model_for('minimax', task)
    voice = kw.get('voice_id') or _env('MINIMAX_SPEECH_VOICE') or 'Wise_Woman'
    if task == 'generate-image':
        return mm_image(prompt, model=model, output_dir=output_dir, verbose=verbose)
    elif task == 'generate-video':
        return mm_video(prompt, model=model, output_dir=output_dir, verbose=verbose)
    elif task == 'generate-speech':
        return generate_speech(text or prompt, model=model, voice_id=voice,
                               output_dir=output_dir, verbose=verbose)
    elif task == 'generate-music':
        return generate_music(lyrics or prompt, model=model, prompt=prompt,
                              output_dir=output_dir, verbose=verbose)
    return {'status': 'error', 'error': f'MiniMax does not support {task}'}


def _call_openrouter(task, prompt='', output_dir='./output', verbose=False, **kw):
    model = kw.get('model') or get_model_for('openrouter', task)
    if task == 'generate-image':
        from openrouter_fallback import generate_image_openrouter
        return generate_image_openrouter(prompt, model=model, output_dir=output_dir, verbose=verbose)
    return {'status': 'error', 'error': f'OpenRouter does not support {task}'}
