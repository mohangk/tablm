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