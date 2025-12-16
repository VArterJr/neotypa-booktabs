I want to create a self-hosted bookmark manager with tabbed view (with groups on tabs). I want this for personal use and I want it to be pure HTML5, CSS, and TypeScript. I'm choosing TypeScript for its more advanced features like ECMAScript features that JavaScript doesn't have. I'll provide some pictures for example.

I'd also like it to have another view that is hierarchical. The user should be able to switch between the two views. 

The only add-ons I want to use are Tailwind latest for CSS and daisyUI on top of that for components and theme control. I want the data stored in a database on the server (just a plain old Linux VPS with a webserver on it). I'd prefer it be SQLite so it can just be a file vs. a whole database system that has to be installed. I want simple deployment.

Use daisyUI for consistent theming and components (and include ALL daisyUI themes letting the user change it from the header / toolbar).

As mentioned, there should be two designs.
1. Tabbed view with groups on tabs
2. Hierarchical view with nested folders

The user should be able to switch between the two views easily.

That means we may need to restrict the depth of nesting. The information hierarchy will be:
  - Folders: Tabs for Tabbed view or Folders for Hierarchical view
    - Groups: Groups for Tabbed view or Subfolders for Hierarchical view
      - Bookmarks: Bookmarks should support the following fields:
        - URL
        - Title
        - Description
        - Tags (multiple)

I'd love to support drag and drop for reordering bookmarks within groups, moving bookmarks between groups, reordering groups within folders/tabs, and moving groups between folders/tabs. I know that will hard on tab view, but for hierarchical view it should be easier and view wise reflect in both views.

From a data perspective, user should be the top thing that indexes all of the data. The database will support multiple users, each with their own set of folders/tabs, groups/subfolders, and bookmarks ... and even their look-n-feel preferences (daisyUI theme) and last select view (tabbed vs hierarchical).

For now, just store the password as plain text in the database. Later we can improve security.

Be sure that all items in the UI support modification operations (New / Create, Edit, Delete). For the database, I know we'll need a service or something to read and write the database from the UI changes, but think about that hard. I don't want this to be difficult to deploy. If we can use TypeScript or such, let me know how you want to do that. I don't want to have to install a whole backend framework if we can avoid it.

The application should have a clean and intuitive user interface, leveraging Tailwind CSS and daisyUI components for consistency and ease of use. The header/toolbar should include options for switching views, changing themes, and accessing user settings.

Use all best practices on design and code structure for a TypeScript web application. Make sure to separate concerns properly (e.g., data handling, UI rendering, event handling). Remember, I want ease of maintenance and deployment. Follow good coding standards. Even though this isn't OOD, thing about code smells and SOLID type principles where applicable.

Finally, ensure that the application is responsive and works well on both desktop and mobile devices. Document all of your work as appropriate for this type of application in the doc folder at the root of the project. Include setup instructions, design decisions, and any other relevant information. Include a schema / ERD for the database design as well and object model for code. Keep the working folder and source well organized for this type of project.