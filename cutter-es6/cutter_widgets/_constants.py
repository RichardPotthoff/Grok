"""Shared anywidget assets for the cutter notebook widgets."""

PAGES_ES6 = "https://richardpotthoff.github.io/Grok/cutter-es6/es6"

WIDGET_CSS = """
.cutter-anyui-host { min-height: 260px; height: 320px; width: 100%; position: relative; }
.cutter-anyui-host canvas { width: 100%; height: 100%; display: block; touch-action: none; background: #12110f; }
.path-table-wrap { max-height: 240px; overflow: auto; width: 100%; padding: 6px 4px 12px; }
.path-stats { margin: 0 0 8px; font-size: 12px; color: #666; }
.path-table-wrap table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 13px; }
.path-table-wrap th { text-align: left; color: #666; font-weight: 500; padding: 4px 6px; }
.path-table-wrap td { padding: 2px 6px; }
.path-table-wrap td input { width: 100%; padding: 4px 6px; }
.path-table-wrap tr.sel td { background: #d7ebe6; }
"""
