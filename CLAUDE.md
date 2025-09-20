# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TabLM is a Chrome extension that provides intelligent tab management with AI-powered features. It helps users organize browser tabs, search through them, and provides a chat interface for interacting with page content using Claude AI.

## Architecture

### Core Components

- **tablm.js**: Main application logic, event handlers, and Chrome extension integration
- **tabList.js**: Tab rendering and formatting utilities (ES6 modules)
- **service-worker.js**: Chrome extension background script
- **tablm.html**: Side panel UI with navigation, tab lists, and chat interface
- **manifest.json**: Chrome extension configuration (Manifest V3)

### Key Features

1. **Tab Management**: List, sort, search, and close tabs across all windows
2. **AI-Powered Organization**: Automatically categorize tabs using Claude AI API
3. **Chat Interface**: Chat with Claude about active tab content
4. **Caching System**: Smart caching to minimize API calls when organizing tabs

### Data Flow

#### Tab Organization System
The extension uses a sophisticated caching system to minimize Claude API calls:

```javascript
let tabsCache = {
    tabs: null,      // Flat tab data indexed by tab ID
    categories: null // Categorized tabs from Claude (tab IDs only)
};
```

- `haveTabsChanged()` detects meaningful changes (new tabs, URL changes, title changes)
- Tab removals alone don't trigger re-categorization
- Categories store only tab IDs, not full tab objects, for memory efficiency

#### Tab Data Structure
Tabs are stored as a flat object indexed by tab ID:
```javascript
{
  [tabId]: {
    url, title, domain, openDuration, index, active, id, windowId
  }
}
```

### Chrome Extension Integration

- **Side Panel**: Uses `chrome.sidePanel` API for persistent UI
- **Tab Events**: Listens to `chrome.tabs` events (onCreated, onRemoved, onUpdated, onActivated)
- **Window Events**: Handles `chrome.windows.onFocusChanged` for multi-window support
- **Content Scripting**: Extracts page content for AI chat using `chrome.scripting.executeScript`

### AI Integration

- **API**: Uses Claude 3.5 Haiku model via Anthropic API
- **Prompts**: Structured XML prompts for tab organization with explicit JSON output format
- **Context**: Page content extraction for chat functionality
- **Caching**: Intelligent caching system reduces API calls

## Development

### File Structure
- Root directory contains all source files (no build system)
- Static assets: `icon*.png`, `pico.min.css`
- No package.json - vanilla JavaScript Chrome extension

### Key Functions

#### tablm.js
- `updateTabsList(isOrganizedView, activeWindowId)`: Main tab list update function
- `retrieveChromeTabs()`: Fetches and formats tab data from Chrome API
- `getOrganizedTabsFromClaude(tabs)`: Handles AI-powered tab organization with caching
- `haveTabsChanged(tabs)`: Smart change detection for cache invalidation
- `registerTabEventHandlers()`: Sets up tab interaction event listeners

#### tabList.js
- `formatTabInfo(tabData, sortBy, searchTerm)`: Renders standard tab view
- `formatOrganizedTabInfo(categories, tabData)`: Renders AI-organized tab view
- `renderTabItem(tab, windowId)`: Individual tab HTML generation

### State Management
- Session storage for API key persistence
- In-memory caching for organized tabs
- Per-tab chat history storage (`lastChatResponse` object)

### UI Views
1. **Tabs**: Standard tab list with search and sort
2. **Organised tabs**: AI-categorized tab view with loading states
3. **Chat**: AI chat interface with active tab content

### Testing
No automated test framework is currently configured. Manual testing through Chrome extension developer tools is required.

## Important Notes

- API key is stored in session storage, not persisted across browser sessions
- Tab organization requires Claude API key to be configured
- Extension requires Chrome's `activeTab`, `scripting`, `sidePanel`, `storage`, and `tabs` permissions
- Uses ES6 modules for modular code organization
- Legacy/unused code exists in tablm.js (lines 335-428) marked for removal