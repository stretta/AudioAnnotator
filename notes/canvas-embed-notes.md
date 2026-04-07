# Canvas embed notes

This project is intended to be embedded in Canvas LMS via iframe.

Initial assumptions:

- the app is hosted as a static site
- the page can be embedded using a normal iframe on a Canvas content page
- the data source is public
- the audio URL is public and browser-readable

Things to keep in mind during implementation:

- avoid auth
- avoid popup windows
- avoid dependencies on cross-window messaging for v1
- keep the layout compact enough for a content page embed
- make the player readable in widths commonly used inside Canvas pages

Possible future enhancements:

- deep linking to a starting time
- display options tuned for different iframe heights
- optional hide/show of comments
- optional instructor mode with richer annotations