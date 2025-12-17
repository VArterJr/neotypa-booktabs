# Import/Export Feature

The Neotypa Booktabs application supports two export/import formats:

1. **JSON Format** (Recommended for backups): Full-fidelity format that preserves all data including tags, descriptions, and the complete hierarchy
2. **Netscape Bookmark File Format**: Standard HTML format compatible with all modern browsers (Chrome, Firefox, Edge, Safari, etc.)

## JSON Format (Full Backup)

The JSON format is the **recommended** way to backup and restore your complete bookmark data. It preserves everything including:
- Complete workspace/folder/group/bookmark hierarchy
- All bookmark metadata (URLs, titles, descriptions)
- Tags
- Position ordering

### JSON Export

To export your bookmarks to JSON:

1. Click the **Export JSON** button in the header
2. A file named `bookmarks-backup.json` will be downloaded
3. This file contains all your data in a structured JSON format

The exported JSON has this structure:

```json
{
  "version": 1,
  "exportedAt": "2025-12-17T10:30:00.000Z",
  "workspaces": [
    {
      "title": "Personal",
      "position": 0,
      "folders": [
        {
          "title": "Work",
          "position": 0,
          "groups": [
            {
              "title": "Dev Tools",
              "position": 0,
              "bookmarks": [
                {
                  "url": "https://github.com",
                  "title": "GitHub",
                  "description": "Code hosting platform",
                  "tags": ["dev", "code", "git"],
                  "position": 0
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### JSON Import

To import bookmarks from JSON:

1. Click the **Import JSON** button in the header
2. Select your JSON backup file
3. The system will create all workspaces, folders, groups, and bookmarks
4. A summary will show what was imported

**Note**: JSON import creates NEW workspaces and does not merge with existing data. If you want to merge, you'll need to manually organize after import.

### JSON Import Results

After importing, you'll see a summary showing:
- Number of workspaces created
- Number of folders created
- Number of groups created
- Number of bookmarks imported
- Any warnings or errors

## Netscape Format (Browser Compatibility)

The Netscape format is useful for:
- Importing bookmarks from browsers
- Exporting bookmarks to browsers
- Sharing bookmarks with others

**Note**: The Netscape format has limitations and loses some data fidelity (tags, descriptions may not be preserved).

## Overview

- **Export**: Download all your bookmarks as an HTML file in Netscape format
- **Import**: Upload bookmark files from other browsers or previous exports

**For full backups of your Neotypa Booktabs data, use the JSON format instead.**

## Export

To export your bookmarks:

1. Click the **Export** button in the header (download icon)
2. A file named `bookmarks-YYYY-MM-DD.html` will be downloaded
3. This file can be imported into any browser or back into Neotypa Booktabs

### Export Format

The export creates a hierarchical HTML structure:
- **Level 1**: Folders (H3 tags)
- **Level 2**: Groups (H3 tags nested within folders)
- **Level 3**: Bookmarks (A tags with HREF)

## Import

To import bookmarks:

1. Click the **Import** button in the header (upload icon)
2. Select your bookmark HTML file
3. Choose a strategy for handling deeply nested folders (see below)
4. Click **Import**

### Import Strategies

Our system supports a 3-level hierarchy: **Folder → Group → Bookmark**

Many browsers export bookmarks with deeper nesting levels. When importing files with deeper structures, you must choose how to handle them:

#### Flatten (Recommended)
- Converts folders deeper than the 3rd level into groups
- All bookmarks from deeply nested folders are preserved
- Best for preserving all content while adapting to our structure

#### Skip
- Skips bookmarks that are nested deeper than 3 levels
- Useful if you only want top-level bookmarks
- A summary will show how many bookmarks were skipped

### Import Results

After importing, you'll see a summary showing:
- Number of folders created
- Number of groups created
- Number of bookmarks imported
- Number of bookmarks skipped (if any)
- Warnings about any issues encountered

## Technical Details

### Netscape Bookmark Format

The Netscape format is an HTML-based format with this structure:

```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Folder Name</H3>
    <DL><p>
        <DT><H3>Group Name</H3>
        <DL><p>
            <DT><A HREF="https://example.com">Bookmark Title</A>
            <DD>Optional description
        </DL><p>
    </DL><p>
</DL><p>
```

### API Endpoints

#### JSON Format

**`GET /api/export/json`**
- Returns: JSON file with complete bookmark data
- Headers: Sets `Content-Disposition: attachment` for download
- Authentication: Required

**`POST /api/import/json`**
- Body: JSON object matching `JsonExportFormat` schema
- Returns: `ImportResult` object with statistics and warnings
- Authentication: Required

#### Netscape Format

**`GET /api/export`**
- Returns: HTML file (Netscape format)
- Headers: Sets `Content-Disposition: attachment` for download
- Authentication: Required

**`POST /api/import`**
- Body: `{ html: string, strategy: 'flatten' | 'skip' | 'root' }`
- Returns: `ImportResult` object with statistics and warnings
- Authentication: Required

### Import Process

1. **Parse**: HTML is parsed into a tree structure
2. **Validate**: Structure is analyzed for depth and content
3. **Transform**: Deep structures are handled according to strategy
4. **Create**: Folders, groups, and bookmarks are created in database
5. **Report**: Statistics and warnings are returned

## Limitations

### JSON Format
- Import creates new workspaces (does not merge with existing)
- Requires version 1 format (will be versioned for future compatibility)

### Netscape Format
- Maximum 3-level hierarchy (Folder → Group → Bookmark)
- Bookmarks must be inside groups, not directly in folders
- No support for browser-specific metadata (favicons, visit counts, etc.)
- Tags are not preserved during import/export (use JSON format for tags)
- Descriptions may not be preserved by all browsers

## Examples

### Exporting from Chrome

1. Chrome Menu → Bookmarks → Bookmark Manager
2. Three-dot menu → Export bookmarks
3. Save the HTML file
4. Use this file to import into Neotypa Booktabs

### Exporting from Firefox

1. Firefox Menu → Bookmarks → Manage Bookmarks
2. Import and Backup → Export Bookmarks to HTML
3. Save the HTML file
4. Use this file to import into Neotypa Booktabs

### Exporting from Edge

1. Edge Menu → Favorites → Manage favorites
2. Three-dot menu → Export favorites
3. Save the HTML file
4. Use this file to import into Neotypa Booktabs

## Migration Tips

### Using JSON Format for Backups

1. **Regular Backups**: Export to JSON regularly to backup all your data
2. **Account Migration**: Use JSON export/import to move between accounts or installations
3. **Version Control**: Keep timestamped JSON backups to track changes over time
4. **Data Recovery**: JSON format ensures you never lose tags, descriptions, or hierarchy

### Using Netscape Format for Browser Integration

1. **Start Fresh**: Consider exporting from your browser and importing into a new account
2. **Test First**: Try importing with the "Skip" strategy first to see the structure
3. **Cleanup**: After importing, you may want to reorganize folders and groups
4. **Tags**: Add tags manually after import (or use JSON format instead)
5. **Backup**: Always export your bookmarks before major changes

### Best Practices

- **Use JSON for Neotypa Booktabs backups**: Full fidelity, preserves everything
- **Use Netscape for browser integration**: When importing from or exporting to browsers
- **Regular exports**: Set a schedule to export your bookmarks (e.g., monthly)
- **Multiple copies**: Keep backups in different locations (local, cloud storage, etc.)
