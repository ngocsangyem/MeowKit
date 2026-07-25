"""Constants and pure functions for media analysis.

Contains MIME types, modality maps, default prompts, media resolution config.
No API calls or side effects — safe to import anywhere.
"""

from pathlib import Path
from typing import Optional

MIME_TYPES = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.flac': 'audio/flac', '.aac': 'audio/aac',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain', '.html': 'text/html', '.csv': 'text/csv',
}

MODALITY_MAP = {
    'image': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif'],
    'video': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
    'audio': ['.mp3', '.wav', '.m4a', '.flac', '.aac'],
    'document': ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.html', '.csv'],
}

DEFAULT_PROMPTS = {
    'analyze': {
        'image': (
            'Analyze this image. Return structured JSON:\n'
            '{"subject": "main subject/scene",\n'
            ' "elements": ["notable objects, text, UI components"],\n'
            ' "text_content": "any visible text (OCR)",\n'
            ' "quality": "resolution, lighting, issues",\n'
            ' "confidence": 0.0}\n'
            'Be concise. Omit empty fields.'
        ),
        'video': (
            'Analyze this video. Return structured JSON:\n'
            '{"scenes": [{"timestamp": "MM:SS", "description": "..."}],\n'
            ' "key_content": "main subjects and actions",\n'
            ' "audio_summary": "speech/music/ambient",\n'
            ' "duration_sec": 0}\n'
            'Focus on key moments. Omit filler.'
        ),
        'audio': (
            'Analyze this audio. Return structured JSON:\n'
            '{"type": "speech|music|ambient|mixed",\n'
            ' "speakers": 0,\n'
            ' "topics": ["key topics discussed"],\n'
            ' "duration_sec": 0,\n'
            ' "notable_segments": [{"at": "MM:SS", "content": "..."}]}\n'
            'Be concise.'
        ),
        'document': (
            'Analyze this document. Return structured JSON:\n'
            '{"type": "report|form|article|spreadsheet|presentation",\n'
            ' "sections": ["main headings"],\n'
            ' "key_data": {"numbers": [], "dates": [], "names": []},\n'
            ' "tables_count": 0,\n'
            ' "page_count": 0}\n'
            'Omit empty fields.'
        ),
    },
    'transcribe': {
        'audio': (
            'Transcribe this audio accurately.\n'
            'Format: [HH:MM:SS -> HH:MM:SS] Speaker N: transcript\n'
            'Rules: Identify speakers. Timestamps every 30s minimum.\n'
            'Mark [inaudible] or [music] segments.\n'
            'WARNING: If audio >15 min, output may be truncated.'
        ),
        'video': (
            'Transcribe spoken audio from this video.\n'
            'Format: [HH:MM:SS -> HH:MM:SS] Speaker N: transcript\n'
            'Note [on-screen text: "..."] for important overlays.\n'
            'Timestamps every 30s minimum.'
        ),
    },
    'extract': {
        'document': (
            'Extract to clean Markdown. Preserve heading hierarchy (# ## ###).\n'
            'Convert tables to Markdown tables. Skip headers/footers/page numbers.\n'
            'For images: [Image: brief description].'
        ),
        'image': (
            'Extract all visible text (OCR). Preserve spatial layout.\n'
            'Use Markdown formatting. Mark uncertain text with [?].\n'
            'Group by visual regions (header, body, sidebar).'
        ),
    },
}

MEDIA_RESOLUTION_MAP = {
    'image': 'MEDIA_RESOLUTION_HIGH',
    'document': 'MEDIA_RESOLUTION_MEDIUM',
    'video': 'MEDIA_RESOLUTION_LOW',
    'audio': None,
}

MAX_OUTPUT_CHARS = 6000


def detect_modality(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    for modality, extensions in MODALITY_MAP.items():
        if ext in extensions:
            return modality
    return 'unknown'


def get_prompt(task: str, modality: str, custom_prompt: Optional[str] = None) -> str:
    if custom_prompt:
        return custom_prompt
    task_prompts = DEFAULT_PROMPTS.get(task, {})
    return task_prompts.get(modality, f'{task.capitalize()} this {modality}.')
