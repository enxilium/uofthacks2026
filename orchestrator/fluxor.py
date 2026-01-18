#!/usr/bin/env python3
"""
Fluxor AI Orchestrator - Python TUI using Textual
Autonomous UX improvement agent with real-time observability
"""

import os
import json
import asyncio
import textwrap
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.widgets import Header, Footer, Static, RichLog, ProgressBar, Label, Rule
from textual.reactive import reactive
from textual import work
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.console import Group

# Load environment variables
load_dotenv()

# ============================================
# Configuration
# ============================================

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-3-flash-preview"

ORCHESTRATOR_URL = "http://127.0.0.1:8787"
EVENTS_THRESHOLD = 20
MIN_EVENTS_FOR_ANALYSIS = 5  # Don't analyze until we have at least this many events

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")


# ============================================
# Types
# ============================================

class Phase(Enum):
    IDLE = "idle"
    ANALYZING = "analyzing"
    EXPERIMENTING = "experimenting"
    EVALUATING = "evaluating"
    DECIDING = "deciding"


class ExperimentStatus(Enum):
    COLLECTING = "collecting"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    REVERTED = "reverted"


@dataclass
class AgentThought:
    timestamp: datetime
    phase: Phase
    thinking: str
    reasoning: str
    action: Optional[str] = None


@dataclass
class ActiveExperiment:
    id: str
    prompt: str
    start_timestamp: str
    collected_events: list = field(default_factory=list)
    status: ExperimentStatus = ExperimentStatus.COLLECTING


@dataclass
class Stats:
    total_analyses: int = 0
    experiments_started: int = 0
    experiments_succeeded: int = 0
    experiments_reverted: int = 0
    events_processed: int = 0


# ============================================
# Supabase Client
# ============================================

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================
# File Reading Helpers
# ============================================

# Path to the checkout page relative to workspace root
PAGE_TSX_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "page.tsx")

def read_page_tsx() -> str:
    """Read the current contents of app/page.tsx"""
    try:
        with open(PAGE_TSX_PATH, "r") as f:
            return f.read()
    except Exception as e:
        return f"[Error reading page.tsx: {e}]"


# ============================================
# JSON Schemas for Structured Output
# ============================================

ANALYSIS_SCHEMA = {
    "name": "behavior_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "thinking": {
                "type": "string",
                "description": "Your internal thought process about the data (1-2 sentences)"
            },
            "reasoning": {
                "type": "string",
                "description": "Why you're making these conclusions (1-2 sentences)"
            },
            "anomalies": {
                "type": "array",
                "description": "List of detected UX problems",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["rage_click", "slow_interaction", "abandonment", "confusion", "form_frustration"]
                        },
                        "severity": {
                            "type": "string",
                            "enum": ["low", "medium", "high"]
                        },
                        "description": {
                            "type": "string",
                            "description": "What the problem is"
                        },
                        "affected_element": {
                            "type": "string",
                            "description": "Element id or description"
                        }
                    },
                    "required": ["type", "severity", "description", "affected_element"],
                    "additionalProperties": False
                }
            },
            "action_items": {
                "type": "array",
                "description": "Specific code changes to fix the issues",
                "items": {
                    "type": "object",
                    "properties": {
                        "change_description": {
                            "type": "string",
                            "description": "Human-readable description of the change"
                        },
                        "file_path": {
                            "type": "string",
                            "description": "Path to file to modify (e.g., app/page.tsx)"
                        },
                        "prompt": {
                            "type": "string",
                            "description": "Detailed instruction for the coding agent"
                        },
                        "priority": {
                            "type": "string",
                            "enum": ["low", "medium", "high"]
                        },
                        "expected_improvement": {
                            "type": "string",
                            "description": "What metric should improve"
                        }
                    },
                    "required": ["change_description", "file_path", "prompt", "priority", "expected_improvement"],
                    "additionalProperties": False
                }
            },
            "summary": {
                "type": "string",
                "description": "Brief overall summary of findings"
            }
        },
        "required": ["thinking", "reasoning", "anomalies", "action_items", "summary"],
        "additionalProperties": False
    }
}

EVALUATION_SCHEMA = {
    "name": "experiment_evaluation",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "thinking": {
                "type": "string",
                "description": "Your thought process about the results (1-2 sentences)"
            },
            "reasoning": {
                "type": "string",
                "description": "Why you're making this verdict (1-2 sentences)"
            },
            "verdict": {
                "type": "string",
                "enum": ["good_change", "useless_change"],
                "description": "Whether to keep or revert the change"
            },
            "metrics": {
                "type": "object",
                "properties": {
                    "before": {
                        "type": "object",
                        "properties": {
                            "rage_click_rate": {"type": "number"},
                            "completion_rate": {"type": "number"}
                        },
                        "required": ["rage_click_rate", "completion_rate"],
                        "additionalProperties": False
                    },
                    "after": {
                        "type": "object",
                        "properties": {
                            "rage_click_rate": {"type": "number"},
                            "completion_rate": {"type": "number"}
                        },
                        "required": ["rage_click_rate", "completion_rate"],
                        "additionalProperties": False
                    }
                },
                "required": ["before", "after"],
                "additionalProperties": False
            },
            "improvement_summary": {
                "type": "string",
                "description": "Brief summary of the impact"
            }
        },
        "required": ["thinking", "reasoning", "verdict", "metrics", "improvement_summary"],
        "additionalProperties": False
    }
}


# ============================================
# Schema Validation Helpers
# ============================================

def _type_ok(value, expected: str) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    return True


def validate_schema(value, schema: dict, path: str = "$") -> list[str]:
    errors: list[str] = []
    expected_type = schema.get("type")
    if expected_type and not _type_ok(value, expected_type):
        errors.append(f"{path}: expected {expected_type}, got {type(value).__name__}")
        return errors

    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value '{value}' not in enum {schema['enum']}")

    if expected_type == "object":
        props = schema.get("properties", {})
        required = schema.get("required", [])
        additional = schema.get("additionalProperties", True)

        for key in required:
            if key not in value:
                errors.append(f"{path}.{key}: missing required property")

        for key, val in value.items():
            if key in props:
                errors.extend(validate_schema(val, props[key], f"{path}.{key}"))
            elif additional is False:
                errors.append(f"{path}.{key}: additional property not allowed")

    if expected_type == "array":
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(value):
                errors.extend(validate_schema(item, item_schema, f"{path}[{i}]"))

    return errors


# ============================================
# AI Agent Functions
# ============================================

async def call_agent(prompt: str, system_prompt: str, response_schema: dict) -> str:
    """Call Gemini via OpenRouter API with JSON output"""
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not configured")

    # Build schema description for the prompt
    schema_json = json.dumps(response_schema.get("schema", {}), indent=2)
    enhanced_prompt = f"""{prompt}

You MUST respond with valid JSON matching this exact schema:
{schema_json}

Respond ONLY with the JSON object, no markdown or explanation."""

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OPENROUTER_API_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Fluxor AI Agent",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": enhanced_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 4096,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": response_schema,
                },
                "provider": {
                    "require_parameters": True,
                },
            },
        )
        if response.status_code >= 400:
            raise ValueError(f"OpenRouter error {response.status_code}: {response.text}")
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


# ============================================
# Custom Widgets
# ============================================

class StatsPanel(Static):
    """Widget to display stats"""
    
    stats = reactive(Stats())
    
    def render(self) -> Text:
        text = Text()
        text.append("╭─────────────────────────────────────────────────────────────────────────────╮\n", style="dim cyan")
        text.append("│  ", style="dim cyan")
        text.append("📊 STATS", style="bold white")
        text.append("  ║  ", style="dim")
        text.append(f"🔍 Analyses: ", style="cyan")
        text.append(f"{self.stats.total_analyses}", style="bold cyan")
        text.append("  ║  ", style="dim")
        text.append(f"🧪 Experiments: ", style="yellow")
        text.append(f"{self.stats.experiments_started}", style="bold yellow")
        text.append("  ║  ", style="dim")
        text.append(f"✅ ", style="green")
        text.append(f"{self.stats.experiments_succeeded}", style="bold green")
        text.append("  ║  ", style="dim")
        text.append(f"⏪ ", style="red")
        text.append(f"{self.stats.experiments_reverted}", style="bold red")
        text.append("  ║  ", style="dim")
        text.append(f"📡 Events: ", style="magenta")
        text.append(f"{self.stats.events_processed}", style="bold magenta")
        text.append("  │\n", style="dim cyan")
        text.append("╰─────────────────────────────────────────────────────────────────────────────╯", style="dim cyan")
        return text


class PhaseIndicator(Static):
    """Widget to show current phase with animation"""
    
    phase = reactive(Phase.IDLE)
    
    PHASE_CONFIG = {
        Phase.IDLE: ("💤", "dim", "░░░ IDLE ░░░", "Waiting for events..."),
        Phase.ANALYZING: ("🔍", "bold cyan", "▓▓▓ ANALYZING ▓▓▓", "Scanning behavior data..."),
        Phase.EXPERIMENTING: ("🧪", "bold yellow", "███ EXPERIMENTING ███", "Deploying code changes..."),
        Phase.EVALUATING: ("📊", "bold magenta", "▒▒▒ EVALUATING ▒▒▒", "Measuring impact..."),
        Phase.DECIDING: ("🤔", "bold green", "▶▶▶ DECIDING ▶▶▶", "Making verdict..."),
    }
    
    def render(self) -> Text:
        emoji, color, label, desc = self.PHASE_CONFIG[self.phase]
        text = Text()
        text.append("  ┃ ", style="dim")
        text.append(f"{emoji} ", style=color)
        text.append(label, style=color)
        text.append(f"  ─  {desc}", style="italic dim")
        text.append(" ┃", style="dim")
        return text


class ExperimentWidget(Static):
    """Widget to display a single experiment"""
    
    def __init__(self, experiment: ActiveExperiment, **kwargs):
        super().__init__(**kwargs)
        self.experiment = experiment
    
    def render(self) -> Panel:
        progress = min(100, (len(self.experiment.collected_events) / EVENTS_THRESHOLD) * 100)
        bar_filled = int(progress / 5)
        bar_empty = 20 - bar_filled
        progress_bar = "█" * bar_filled + "░" * bar_empty
        
        status_colors = {
            ExperimentStatus.COLLECTING: "yellow",
            ExperimentStatus.EVALUATING: "cyan",
            ExperimentStatus.COMPLETED: "green",
            ExperimentStatus.REVERTED: "red",
        }
        color = status_colors[self.experiment.status]
        
        text = Text()
        text.append(f"[{self.experiment.id[:8]}] ", style="dim")
        text.append(self.experiment.status.value, style=color)
        text.append(f" │ Events: {len(self.experiment.collected_events)}/{EVENTS_THRESHOLD} ")
        text.append(f"[{progress_bar}] {progress:.0f}%", style="cyan")
        
        return Panel(text, title="🧪 Experiment", border_style="yellow")


class ThoughtWidget(Static):
    """Widget to display a single thought"""
    
    def __init__(self, thought: AgentThought, **kwargs):
        super().__init__(**kwargs)
        self.thought = thought
    
    def render(self) -> Panel:
        phase_styles = {
            Phase.IDLE: ("💤", "dim white", "──"),
            Phase.ANALYZING: ("🔍", "bold cyan", "══"),
            Phase.EXPERIMENTING: ("🧪", "bold yellow", "▓▓"),
            Phase.EVALUATING: ("📊", "bold magenta", "░░"),
            Phase.DECIDING: ("🤔", "bold green", "▶▶"),
        }
        
        emoji, phase_style, border_char = phase_styles[self.thought.phase]
        time_str = self.thought.timestamp.strftime("%H:%M:%S")
        wrap_width = 74
        thinking_text = textwrap.fill(self.thought.thinking, width=wrap_width, subsequent_indent="     ")
        reasoning_text = textwrap.fill(self.thought.reasoning, width=wrap_width, subsequent_indent="     ")
        action_text = textwrap.fill(self.thought.action or "", width=wrap_width, subsequent_indent="     ")
        
        # Build decorated content
        content = Text()
        
        # Header line with timestamp and phase
        content.append(f"┌{'─' * 72}┐\n", style="dim")
        content.append("│ ", style="dim")
        content.append(f"{emoji} ", style=phase_style)
        content.append(self.thought.phase.value.upper(), style=phase_style)
        content.append(f" @ {time_str}", style="dim cyan")
        content.append(" │\n", style="dim")
        content.append(f"└{'─' * 72}┘\n", style="dim")
        
        # Thinking section
        content.append("\n  💭 ", style="bold white")
        content.append("THINKING", style="bold underline white")
        content.append("\n     ", style="")
        content.append(f"{thinking_text}\n", style="italic white")
        
        # Reasoning section
        content.append("\n  🧠 ", style="bold yellow")
        content.append("REASONING", style="bold underline yellow")
        content.append("\n     ", style="")
        content.append(f"{reasoning_text}\n", style="italic yellow")
        
        # Action section (if present)
        if self.thought.action:
            content.append("\n  ⚡ ", style="bold green")
            content.append("ACTION", style="bold underline green")
            content.append("\n     ", style="")
            content.append(f"{action_text}\n", style="bold green")
        
        border_colors = {
            Phase.IDLE: "dim",
            Phase.ANALYZING: "cyan",
            Phase.EXPERIMENTING: "yellow",
            Phase.EVALUATING: "magenta",
            Phase.DECIDING: "green",
        }
        
        return Panel(
            content, 
            border_style=border_colors[self.thought.phase],
            title=f"[bold]{emoji} {self.thought.phase.value.upper()}[/]",
            subtitle=f"[dim]{time_str}[/]",
            padding=(0, 1),
        )


# ============================================
# Main Application
# ============================================

class FluxorApp(App):
    """Fluxor AI Orchestrator TUI"""
    
    CSS = """
    Screen {
        layout: grid;
        grid-size: 1;
        grid-rows: auto auto auto 1fr auto;
        background: $surface-darken-2;
    }
    
    #header-container {
        height: auto;
        padding: 1 2;
        background: $primary-darken-3;
        border: heavy $primary;
    }
    
    #title {
        text-align: center;
        text-style: bold;
        color: $text;
    }
    
    #subtitle {
        text-align: center;
        color: $primary-lighten-2;
    }
    
    #stats-bar {
        height: auto;
        padding: 1 2;
        background: $surface-darken-1;
        border-bottom: solid $primary-darken-2;
    }
    
    #phase-bar {
        height: auto;
        padding: 1 2;
        background: $surface;
        border-bottom: dashed $secondary;
    }
    
    #main-content {
        padding: 1 2;
    }
    
    #experiments-panel {
        display: none;
        height: 100%;
        border: round $secondary;
        padding: 1;
        background: $surface-darken-1;
        margin-right: 1;
    }
    
    #experiments-panel.visible {
        display: block;
    }
    
    #thoughts-panel {
        height: 100%;
        border: round $primary;
        padding: 1;
        background: $surface-darken-1;
    }
    
    .panel-title {
        text-style: bold;
        padding-bottom: 1;
        color: $primary-lighten-1;
    }
    
    #footer-info {
        height: auto;
        padding: 1 2;
        background: $surface-darken-2;
        text-align: center;
        border-top: solid $primary-darken-2;
        color: $text-muted;
    }
    
    RichLog {
        height: 100%;
        scrollbar-gutter: stable;
        background: $surface-darken-2;
        padding: 0 1;
    }
    
    /* When experiments visible, use grid layout */
    #main-content.with-experiments {
        layout: grid;
        grid-size: 2;
        grid-columns: 1fr 2fr;
    }
    """
    
    BINDINGS = [
        ("q", "quit", "Quit"),
        ("a", "analyze", "Analyze"),
        ("e", "toggle_experiments", "Experiments"),
        ("r", "refresh", "Refresh"),
    ]
    
    show_experiments = reactive(False)
    
    def __init__(self):
        super().__init__()
        self.stats = Stats()
        self.current_phase = Phase.IDLE
        self.experiments: dict[str, ActiveExperiment] = {}
        self.thoughts: list[AgentThought] = []
        self._polling_task: Optional[asyncio.Task] = None
        self._session_watch_task: Optional[asyncio.Task] = None
        self.known_sessions: set[str] = set()  # Track seen session IDs
    
    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        
        with Container(id="header-container"):
            yield Static("╔══════════════════════════════════════════════════════════════╗", id="border-top")
            yield Static("║  🤖  F L U X O R   A I   O R C H E S T R A T O R  🤖  ║", id="title")
            yield Static("╚══════════════════════════════════════════════════════════════╝", id="border-bottom")
            yield Static("⚡ Autonomous UX Improvement Agent ⚡", id="subtitle")
        
        yield StatsPanel(id="stats-bar")
        yield PhaseIndicator(id="phase-bar")
        
        with Horizontal(id="main-content"):
            with Vertical(id="experiments-panel"):
                yield Static("🧪 Active Experiments", classes="panel-title")
                yield RichLog(id="experiments-log", highlight=True, markup=True, wrap=True, max_lines=None)
            
            with Vertical(id="thoughts-panel"):
                yield Static("💭 Agent Thought Stream", classes="panel-title")
                yield RichLog(id="thoughts-log", highlight=True, markup=True, wrap=True, max_lines=None)
        
        yield Static("⌨️  [bold cyan]Q[/] Quit │ [bold cyan]A[/] Analyze │ [bold cyan]E[/] Toggle Experiments │ [bold cyan]R[/] Refresh │ Logs update in real-time 🔄", id="footer-info")
        yield Footer()
    
    def watch_show_experiments(self, show: bool) -> None:
        """React to show_experiments changes"""
        experiments_panel = self.query_one("#experiments-panel")
        main_content = self.query_one("#main-content")
        
        if show:
            experiments_panel.add_class("visible")
            main_content.add_class("with-experiments")
        else:
            experiments_panel.remove_class("visible")
            main_content.remove_class("with-experiments")
    
    def action_toggle_experiments(self) -> None:
        """Toggle experiments panel visibility"""
        self.show_experiments = not self.show_experiments
    
    async def on_mount(self) -> None:
        """Called when app is mounted"""
        self.add_thought(
            Phase.IDLE,
            "Fluxor AI Orchestrator initialized.",
            "Waiting for new users to trigger analysis.",
            "Watching for new session IDs in the database..."
        )
        
        # Load existing sessions from DB so we don't trigger on old users
        await self._load_existing_sessions()
        
        # Start watching for new sessions (this triggers analysis)
        self._session_watch_task = asyncio.create_task(self._watch_for_new_sessions())
        
        # Start polling for experiment events
        self._polling_task = asyncio.create_task(self._poll_for_events())
    
    async def _load_existing_sessions(self) -> None:
        """Load existing session IDs from DB so we don't trigger on startup"""
        if not supabase:
            return
        
        try:
            response = supabase.table("behavior_events").select("session_id").execute()
            if response.data:
                for event in response.data:
                    self.known_sessions.add(event.get("session_id", ""))
                
                self.add_thought(
                    Phase.IDLE,
                    f"Loaded {len(self.known_sessions)} existing sessions.",
                    "Will only trigger analysis on NEW users.",
                    f"Watching for new session IDs..."
                )
        except Exception as e:
            self.add_thought(
                Phase.IDLE,
                f"Could not load existing sessions: {str(e)[:50]}",
                "Will treat all sessions as new."
            )
    
    async def _watch_for_new_sessions(self) -> None:
        """Watch for new session IDs and trigger analysis when found"""
        while True:
            await asyncio.sleep(2)  # Check every 2 seconds
            
            if not supabase:
                continue
            
            try:
                # Get distinct session IDs from recent events
                response = supabase.table("behavior_events").select("session_id").order(
                    "created_at", desc=True
                ).limit(100).execute()
                
                if response.data:
                    current_sessions = set(e.get("session_id", "") for e in response.data)
                    new_sessions = current_sessions - self.known_sessions
                    
                    if new_sessions:
                        # Found new user(s)!
                        for new_session in new_sessions:
                            self.known_sessions.add(new_session)
                        
                        # Check if we have enough total events to analyze
                        total_events = len(response.data)
                        if total_events < MIN_EVENTS_FOR_ANALYSIS:
                            self.add_thought(
                                Phase.IDLE,
                                f"🆕 New user detected: {list(new_sessions)[0][:8]}...",
                                f"Only {total_events} events so far. Need at least {MIN_EVENTS_FOR_ANALYSIS} to analyze.",
                                "Waiting for more user activity..."
                            )
                            continue
                        
                        self.add_thought(
                            Phase.IDLE,
                            f"🆕 NEW USER DETECTED! Session: {list(new_sessions)[0][:8]}...",
                            f"Have {total_events} events. Time to analyze and improve their experience!",
                            "Triggering analysis cycle..."
                        )
                        
                        # Trigger analysis for this new user
                        self.run_analysis_cycle()
            
            except Exception as e:
                # Silently continue on error
                pass
    
    def add_thought(self, phase: Phase, thinking: str, reasoning: str, action: Optional[str] = None) -> None:
        """Add a new thought to the log"""
        thought = AgentThought(
            timestamp=datetime.now(),
            phase=phase,
            thinking=thinking,
            reasoning=reasoning,
            action=action
        )
        self.thoughts.append(thought)
        
        # Update phase indicator
        phase_indicator = self.query_one("#phase-bar", PhaseIndicator)
        phase_indicator.phase = phase
        self.current_phase = phase
        
        # Write to thoughts log
        thoughts_log = self.query_one("#thoughts-log", RichLog)
        widget = ThoughtWidget(thought)
        thoughts_log.write(widget.render())
    
    def update_stats(self) -> None:
        """Update the stats display"""
        stats_panel = self.query_one("#stats-bar", StatsPanel)
        stats_panel.stats = Stats(
            total_analyses=self.stats.total_analyses,
            experiments_started=self.stats.experiments_started,
            experiments_succeeded=self.stats.experiments_succeeded,
            experiments_reverted=self.stats.experiments_reverted,
            events_processed=self.stats.events_processed
        )
    
    def update_experiments_display(self) -> None:
        """Update the experiments log"""
        experiments_log = self.query_one("#experiments-log", RichLog)
        experiments_log.clear()
        
        if not self.experiments:
            experiments_log.write("[dim]No active experiments...[/]")
            return
        
        for exp in self.experiments.values():
            widget = ExperimentWidget(exp)
            experiments_log.write(widget.render())
    
    async def _poll_for_events(self) -> None:
        """Poll Supabase for new events for active experiments"""
        while True:
            await asyncio.sleep(2)  # Poll every 2 seconds
            
            if not supabase:
                continue
            
            for exp_id, exp in list(self.experiments.items()):
                if exp.status != ExperimentStatus.COLLECTING:
                    continue
                
                try:
                    # Fetch events after experiment start
                    response = supabase.table("behavior_events").select("*").gte(
                        "created_at", exp.start_timestamp
                    ).order("created_at", desc=False).execute()
                    
                    if response.data:
                        exp.collected_events = response.data
                        self.update_experiments_display()
                        
                        # Check if we have enough events
                        if len(exp.collected_events) >= EVENTS_THRESHOLD:
                            exp.status = ExperimentStatus.EVALUATING
                            self.update_experiments_display()
                            self.evaluate_experiment(exp)
                
                except Exception as e:
                    self.add_thought(
                        Phase.IDLE,
                        f"Error polling events: {str(e)[:50]}",
                        "Will retry on next poll cycle"
                    )
    
    @work(exclusive=False)
    async def run_analysis_cycle(self) -> None:
        """Run the main analysis cycle"""
        # Check if we have too many active experiments
        active_count = sum(1 for e in self.experiments.values() 
                         if e.status == ExperimentStatus.COLLECTING)
        if active_count >= 3:
            self.add_thought(
                Phase.IDLE,
                f"Too many active experiments ({active_count}).",
                "Will analyze after some complete."
            )
            return
        
        await self.analyze_for_anomalies()
    
    async def analyze_for_anomalies(self) -> None:
        """Analyze behavior data for anomalies"""
        self.add_thought(
            Phase.ANALYZING,
            "Fetching recent behavior events from database...",
            "Need to gather current user behavior data to identify potential UX issues."
        )
        
        if not supabase:
            self.add_thought(
                Phase.IDLE,
                "Supabase not configured.",
                "Cannot fetch behavior events."
            )
            return
        
        try:
            # Fetch recent events
            response = supabase.table("behavior_events").select("*").order(
                "created_at", desc=True
            ).limit(200).execute()
            
            events = response.data or []
            self.stats.events_processed += len(events)
            self.update_stats()
            
            if not events:
                self.add_thought(
                    Phase.IDLE,
                    "No events found in database.",
                    "Waiting for user activity..."
                )
                return
            
            # Check minimum events threshold
            if len(events) < MIN_EVENTS_FOR_ANALYSIS:
                self.add_thought(
                    Phase.IDLE,
                    f"Only {len(events)} events in database.",
                    f"Need at least {MIN_EVENTS_FOR_ANALYSIS} events to analyze meaningfully.",
                    "Waiting for more user activity..."
                )
                return
            
            # Prepare data summary
            events_by_type = {}
            for e in events:
                event_type = e.get("event_type", "unknown")
                events_by_type[event_type] = events_by_type.get(event_type, 0) + 1
            
            rage_clicks = [e for e in events if e.get("event_type") == "rage_click"]
            unique_sessions = len(set(e.get("session_id", "") for e in events))
            
            data_summary = {
                "total_events": len(events),
                "unique_sessions": unique_sessions,
                "events_by_type": events_by_type,
                "rage_clicks": len(rage_clicks),
                "rage_click_details": [
                    {
                        "element_id": e.get("element_id"),
                        "element_text": e.get("element_text"),
                        "page_variant": e.get("page_variant"),
                    }
                    for e in rage_clicks[:10]
                ],
                "sample_events": [
                    {
                        "event_type": e.get("event_type"),
                        "element_id": e.get("element_id"),
                        "page_variant": e.get("page_variant"),
                    }
                    for e in events[:30]
                ],
            }
            
            self.add_thought(
                Phase.ANALYZING,
                f"Analyzing {len(events)} events from {unique_sessions} sessions...",
                f"Found {len(rage_clicks)} rage clicks. Sending to Gemini for deep analysis."
            )
            
            # Read the current page.tsx code to give AI context
            page_code = read_page_tsx()
            
            # Call AI agent with structured output
            system_prompt = f"""You are Fluxor, an autonomous AI agent that monitors user behavior on an e-commerce checkout flow and makes iterative UX improvements.

You are monitoring a Next.js application. Here is the CURRENT checkout page code:

```tsx
{page_code}
```

Your job is to analyze behavior data, detect specific UX problems, and suggest ONE targeted code change at a time.

## GUIDELINES

1. Look at the ACTUAL code above - reference real element IDs, class names, and component structure
2. Suggest changes that target SPECIFIC elements you can see in the code
3. The "prompt" field will be sent DIRECTLY to a coding AI agent (opencode)

## EXAMPLE PROMPT FORMATS

Good prompt example:
"In app/page.tsx, find the button with text 'PROCEED TO PAYMENT' and improve it: change the background from bg-orange-500 to bg-green-600, increase padding to py-4 px-8, add hover:scale-105 transition, and change text to 'Complete Purchase ✓'"

Another good example:
"In app/page.tsx, simplify the form by removing the 'middleName', 'altPhone', and 'confirmEmail' fields from the formData state and their corresponding input elements. This reduces friction."

IMPORTANT: Make prompts:
- Specific about WHAT file to edit (always app/page.tsx)
- Specific about WHAT to change (reference actual elements from the code above)
- Specific about HOW to change it (new values, new code patterns)
- Self-contained - the coding agent can see the file but not this conversation"""

            prompt = f"""Analyze this behavior data from the checkout page and identify the most critical UX issue to fix:

{json.dumps(data_summary, indent=2)}

Focus on the most impactful issue based on:
1. Rage clicks indicate frustration - highest priority
2. Repeated form interactions indicate confusion
3. Abandonment patterns indicate friction

Return exactly ONE high-priority action_item with a detailed prompt for the coding agent."""

            response_text = await call_agent(prompt, system_prompt, ANALYSIS_SCHEMA)
            analysis = json.loads(response_text)
            schema_errors = validate_schema(analysis, ANALYSIS_SCHEMA["schema"])
            if schema_errors:
                self.add_thought(
                    Phase.IDLE,
                    "AI response failed schema validation.",
                    "Skipping experiment creation.",
                    "\n".join(schema_errors[:6])
                )
                return
            
            self.stats.total_analyses += 1
            self.update_stats()
            
            thinking = analysis.get("thinking", "Analysis complete")
            reasoning = analysis.get("reasoning", "")
            action_items = analysis.get("action_items", [])
            
            action = f"Identified {len(action_items)} potential improvements" if action_items else "No immediate actions needed"
            
            self.add_thought(Phase.ANALYZING, thinking, reasoning, action)
            
            # Start experiment if we have high priority action items
            if action_items:
                high_priority = next((a for a in action_items if a.get("priority") == "high"), None)
                action_item = high_priority or action_items[0]
                if not action_item.get("prompt"):
                    self.add_thought(
                        Phase.IDLE,
                        "AI action item missing prompt.",
                        "Cannot call orchestrator without a prompt.",
                        "Check model output formatting."
                    )
                    return
                await self.start_experiment(action_item)
            else:
                self.add_thought(
                    Phase.IDLE,
                    "No critical issues detected.",
                    "Will continue monitoring for anomalies."
                )
        
        except Exception as e:
            self.add_thought(
                Phase.IDLE,
                f"Error during analysis: {str(e)[:50]}",
                "Will retry on next cycle."
            )
    
    async def start_experiment(self, action_item: dict) -> None:
        """Start a new experiment"""
        self.add_thought(
            Phase.EXPERIMENTING,
            f"Starting experiment: {action_item.get('change_description', 'Unknown')}",
            f"Priority: {action_item.get('priority')}. Expected: {action_item.get('expected_improvement')}",
            f"Calling opencode with prompt for {action_item.get('file_path')}"
        )
        
        experiment_id = f"exp_{int(datetime.now().timestamp())}_{os.urandom(3).hex()}"
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{ORCHESTRATOR_URL}/begin_experiment",
                    json={
                        "experimentID": experiment_id,
                        "prompt": action_item.get("prompt", ""),
                    },
                )
                response.raise_for_status()
                result = response.json()
            
            if not result.get("ok"):
                raise ValueError(result.get("error", "Unknown error"))
            
            self.stats.experiments_started += 1
            self.update_stats()
            
            experiment = ActiveExperiment(
                id=experiment_id,
                prompt=action_item.get("prompt", ""),
                start_timestamp=result.get("timestamp", datetime.now().isoformat()),
                status=ExperimentStatus.COLLECTING,
            )
            self.experiments[experiment_id] = experiment
            self.update_experiments_display()
            
            self.add_thought(
                Phase.EXPERIMENTING,
                "Code changes applied successfully.",
                f"Now monitoring for {EVENTS_THRESHOLD} new events to evaluate impact.",
                f"Started monitoring for events after {result.get('timestamp', 'now')}"
            )
        
        except Exception as e:
            self.add_thought(
                Phase.IDLE,
                f"Failed to start experiment: {str(e)[:50]}",
                "Will retry on next analysis cycle."
            )
    
    @work(exclusive=False)
    async def evaluate_experiment(self, experiment: ActiveExperiment) -> None:
        """Evaluate an experiment's results"""
        self.add_thought(
            Phase.EVALUATING,
            f"Evaluating experiment {experiment.id[:8]} with {len(experiment.collected_events)} events",
            "Comparing post-change behavior to identify if the change was beneficial."
        )
        
        events = experiment.collected_events
        rage_clicks = len([e for e in events if e.get("event_type") == "rage_click"])
        completions = len([e for e in events if e.get("event_type") == "checkout_complete"])
        unique_sessions = len(set(e.get("session_id", "") for e in events))
        
        events_by_type = {}
        for e in events:
            event_type = e.get("event_type", "unknown")
            events_by_type[event_type] = events_by_type.get(event_type, 0) + 1
        
        experiment_data = {
            "experiment_id": experiment.id,
            "change_prompt": experiment.prompt,
            "events_collected": len(events),
            "unique_sessions": unique_sessions,
            "rage_clicks": rage_clicks,
            "rage_click_rate": rage_clicks / unique_sessions if unique_sessions > 0 else 0,
            "completions": completions,
            "completion_rate": completions / unique_sessions if unique_sessions > 0 else 0,
            "events_by_type": events_by_type,
        }
        
        system_prompt = f"""You are Fluxor, evaluating whether a UX experiment on checkout was successful.

The experiment made the following change to app/page.tsx:
"{experiment.prompt}"

You're comparing user behavior AFTER the change was deployed.

VERDICT RULES:
- "good_change": Rage clicks decreased, completions increased, user flow improved, or clear UX improvement signals
- "useless_change": No improvement, same issues persist, rage clicks still happening, or metrics got worse

Be decisive. If there's no clear improvement, verdict should be "useless_change" so we can revert and try something else.

For the "before" metrics, use reasonable baseline estimates (e.g., if we had rage clicks before, assume a rate like 0.3).
For "after" metrics, calculate from the actual data provided."""

        prompt = f"""Evaluate this experiment's results on checkout:

{json.dumps(experiment_data, indent=2)}

Did the change improve the user experience? Analyze the event patterns and provide your verdict."""

        try:
            response_text = await call_agent(prompt, system_prompt, EVALUATION_SCHEMA)
            evaluation = json.loads(response_text)
            schema_errors = validate_schema(evaluation, EVALUATION_SCHEMA["schema"])
            if schema_errors:
                self.add_thought(
                    Phase.IDLE,
                    "Evaluation response failed schema validation.",
                    "Marking experiment completed without verdict.",
                    "\n".join(schema_errors[:6])
                )
                experiment.status = ExperimentStatus.COMPLETED
                self.update_experiments_display()
                return
            
            thinking = evaluation.get("thinking", "Evaluation complete")
            reasoning = evaluation.get("reasoning", "")
            verdict = evaluation.get("verdict", "useless_change")
            
            self.add_thought(
                Phase.DECIDING,
                thinking,
                reasoning,
                f"Verdict: {verdict.upper()}"
            )
            
            if verdict == "useless_change":
                await self.revert_experiment(experiment)
            else:
                self.stats.experiments_succeeded += 1
                self.update_stats()
                experiment.status = ExperimentStatus.COMPLETED
                self.update_experiments_display()
                
                self.add_thought(
                    Phase.IDLE,
                    "Experiment successful! Keeping the changes.",
                    evaluation.get("improvement_summary", "Changes retained."),
                    f"✅ Changes retained for {experiment.id[:8]}"
                )
                
                # Remove from active after delay
                await asyncio.sleep(10)
                if experiment.id in self.experiments:
                    del self.experiments[experiment.id]
                    self.update_experiments_display()
        
        except Exception as e:
            self.add_thought(
                Phase.IDLE,
                f"Error evaluating experiment: {str(e)[:50]}",
                "Will mark as completed without verdict."
            )
            experiment.status = ExperimentStatus.COMPLETED
            self.update_experiments_display()
    
    async def revert_experiment(self, experiment: ActiveExperiment) -> None:
        """Revert an experiment"""
        self.add_thought(
            Phase.DECIDING,
            "Change was not beneficial. Initiating revert...",
            "Metrics did not improve or got worse after the change.",
            f"Calling opencode to revert {experiment.id[:8]}"
        )
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{ORCHESTRATOR_URL}/revert_experiment",
                    json={"experimentID": experiment.id},
                )
                response.raise_for_status()
                result = response.json()
            
            if result.get("ok"):
                self.stats.experiments_reverted += 1
                self.update_stats()
                experiment.status = ExperimentStatus.REVERTED
                self.update_experiments_display()
                
                self.add_thought(
                    Phase.IDLE,
                    "Experiment reverted successfully.",
                    "Code has been rolled back to previous state.",
                    f"⏪ Reverted {experiment.id[:8]}"
                )
                
                # Remove from active after delay
                await asyncio.sleep(10)
                if experiment.id in self.experiments:
                    del self.experiments[experiment.id]
                    self.update_experiments_display()
            else:
                raise ValueError(result.get("error", "Revert failed"))
        
        except Exception as e:
            self.add_thought(
                Phase.IDLE,
                f"Failed to revert experiment: {str(e)[:50]}",
                "Manual intervention may be required."
            )
    
    def action_analyze(self) -> None:
        """Manually trigger analysis"""
        self.run_analysis_cycle()
    
    def action_refresh(self) -> None:
        """Refresh display"""
        self.update_stats()
        self.update_experiments_display()
    
    async def action_quit(self) -> None:
        """Quit the app and shut down the server"""
        self.add_thought(
            Phase.IDLE,
            "Shutting down Fluxor...",
            "Sending shutdown signal to orchestrator server.",
            "Goodbye! 👋"
        )
        
        # Cancel polling tasks
        if self._polling_task:
            self._polling_task.cancel()
        if self._session_watch_task:
            self._session_watch_task.cancel()
        
        # Shutdown the server
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(f"{ORCHESTRATOR_URL}/shutdown", json={})
        except Exception:
            pass  # Server might already be down or unreachable
        
        # Exit the app
        self.exit()
    
    async def on_unmount(self) -> None:
        """Cleanup on exit"""
        if self._polling_task:
            self._polling_task.cancel()
        if self._session_watch_task:
            self._session_watch_task.cancel()


def main():
    """Main entry point"""
    app = FluxorApp()
    app.run()


if __name__ == "__main__":
    main()
