## TabLM

### About

A simple Chrome extension to help bring more "smarts" to managing your tabs

### User stories

1. List out all the tabs in the current window (done)
2. Add the ability to close tabs (done)
3. Add the ability to jump to tab (done)
7. When new tab is added, update the tab list (done)
4. Add the option to automatically group tabs from a common domain together (done)
5. Add the ability to search through tabs by title or URL (done)
5. Add ability to take the contents of a tab and send it to grabgpt
6. Add the ability to sort tabs 

### Recent Changes

#### Structured Output for Tab Organization (2025-09-21)
- Switched to a schema-based wire format for tab organization responses.
- JSON Schema `TabCategories`: `{ "categories": [ { "name": string, "tabIds": number[] }, ... ] }`.
- OpenAI: uses `response_format: { type: "json_schema", json_schema: TabCategories }` and `max_completion_tokens`.
- Anthropic: does not use `response_format`; prompt updated to request the same array-of-objects shape.
- Parser simplified to only accept the schema wire format; builds `{ [name]: number[] }` internally.
- Adjusted schema to comply with provider subset (removed `uniqueItems`).

#### Advanced Profile Management & UI Overhaul (2025-09-21)
- **Advanced Profile Management**: Implemented a full CRUD (Create, Read, Update, Delete) system for managing multiple configuration profiles, complete with a persistent 'default' profile to prevent errors.
- **Stateful UI Workflow**: The configuration UI is now stateful, with distinct 'view', 'edit', and 'create' modes. This prevents accidental edits and makes the user flow more intentional.
- **Explicit Save Model**: Removed the old auto-saving behavior. Changes to a profile are now only persisted when the "Save" button is explicitly clicked.
- **Improved UX**: Selecting a profile from the dropdown automatically loads it in a read-only state. A "Cancel" button was added to easily discard any changes.
- **Polished UI Layout**: Refined the CSS to create a cleaner, more compact, and better-aligned layout in the configuration panel, resizing oversized controls and improving spacing.

#### Configuration Management Improvements (2025-09-21)
- **Complete configuration system overhaul**: Added comprehensive AI configuration management with support for multiple providers (Anthropic, OpenAI, Together AI, Groq, Custom)
- **New configuration UI**: Added dedicated Configuration tab with provider selection, model configuration, and endpoint management
- **Multi-API support**: Replaced Claude-specific `sendPromptToClaude` with generic `sendPromptToAI` supporting both Anthropic and OpenAI API formats
- **Persistent configuration**: Migrated from session storage to local storage for configuration persistence across browser sessions

#### Changed Tab Update Logic (2025-02-08 23:11:41 +08)
- Made window ID handling more explicit and consistent:
  - Modified `retrieveChromeTabs` to return only the tabs object and not the activeWindowId
  - Modified `updateTabsList` to require explicit `activeWindowId` parameter instead of using optional parameter with fallback
  - Moved window ID determination logic to call sites (DOM event handlers)
  - Updated all event handlers to explicitly pass window IDs:
    - Initial page load now gets current window ID
    - Window focus change handler passes the focused window ID
    - Tab event handlers (create/remove/update) pass their respective window IDs
    - Search and sort handlers get and pass current window ID
  - Made async/await usage consistent across event handlers
- Simplified data passing in organized view:
  - Removed unnecessary object wrapping of tab data
  - Made parameter usage more consistent between regular and organized views

#### Improved Tab Organization System (2025-02-08 22:00:08 +08)
- Simplified data flow in tab organization functions to use flat tab structure
- Modified functions to accept only the data they need:
  - `haveTabsChanged` now accepts just the tabs object
  - `queryClaudeForTabs` now accepts just the tabs object
  - `getOrganizedTabsFromClaude` now accepts just the tabs object
- Clarified tab change detection logic:
  - Tab removals alone don't trigger re-categorization
  - Only new tabs or modified tabs trigger re-categorization
  - Removed tabs are automatically pruned from categories
- Removed unnecessary nesting in tabsCache structure
- Improved code consistency and modularity

- Modified categorization system to store only tab IDs instead of full tab objects
- Categories now contain arrays of tab IDs which reference the original tab data
- Reduced memory usage by avoiding duplicate tab data storage
- Improved tab lookup efficiency in organized views
- Updated `haveTabsChanged` function to work with tab IDs
- Simplified cache management by using direct references
- Enhanced prompt to ensure all tabs are categorized by:
  - Including total tab count in the task description
  - Adding explicit requirement that every tab must be assigned exactly one category
  - Specifying that sum of tabs across categories must equal total tab count

Example of new category structure:
```javascript
{
    "Work": [1, 2, 3],
    "Social": [4, 5],
    "Shopping": [6, 7]
}
```

#### Added Tab Organization Caching System (2024-03-21)
- Implemented smart caching system for organized tabs to reduce Claude API calls
- Added `haveTabsChanged()` function to detect meaningful tab updates
- Enhanced tab removal handling without requiring re-categorization
- Improved performance through `getOrganizedTabsFromClaude()` caching logic
- Added efficient filtering system to maintain category consistency

The caching system uses a two-part structure:
```javascript
let tabsCache = {
    tabs: null,      // Original tab data for comparison
    categories: null  // Categorized tabs from Claude
};
```

#### Added Organized Tabs View
- Added new "Organised tabs" navigation option
- Implemented tab categorization using Claude AI
- Added loading state while tabs are being organized
- Added new styles for domain groups and organized tab layout

#### Improved Tab Management
- Centralized tab list updates through `updateTabsList` function
- Removed redundant Chrome API calls
- Enhanced close button functionality to work in both regular and organized views
- Updated model to use latest Claude 3.5 Haiku version
- Increased max tokens to 8192 for better categorization

#### Enhanced Claude Integration
- Enhanced the Claude prompt structure using XML tags for better clarity and consistency
- Added explicit JSON output format specification to ensure reliable responses
- Improved tab categorization by providing clear examples of expected data structure
- Fixed issues with tab IDs in the organized view to ensure close buttons work correctly

The prompt now uses Anthropic's recommended practices for structured output:
```
<task>...</task>
<output_format>...</output_format>
<input_data>...</input_data>
```

This results in more consistent and reliable tab categorization responses from Claude. 