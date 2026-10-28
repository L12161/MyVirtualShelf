/* ==========================================================================
   THE SHELF: your content lives in this file.

   Easiest: add things with the form at  <your site>/admin.html

   By hand: put the cover in "covers", copy an entry below, paste it at the
   TOP of its list and change the values. Keep the comma between entries.
   Dates are year-month, like "2026-08". Ratings are 1 to 5.
   Videos only need the YouTube link (url): the thumbnail is fetched for you.

   site.background      the background image (replace assets/background.jpg)
   site.backgroundDim   0 = image at full strength, 1 = fully dark
   ========================================================================== */

window.SHELF = {
  site: {
    title: "The Shelf",
    tagline: "things worth keeping",
    background: "assets/background.jpg",
    backgroundDim: 0.72
  },

  books: [
    {
      title: "1984",
      author: "George Orwell",
      finished: "2025-10",
      rating: 5,
      take: "Bleaker every time I reread it. The appendix on Newspeak is quietly the scariest part."
    }
  ],

  films: [
    {
      title: "Utsab",
      director: "Rituparno Ghosh",
      year: 2000,
      cover: "covers/utsab.jpg",
      watched: "2026-10",
      rating: 5,
      take: "Hindsight is 20/20. No movie lets you feel it as much as this one."
    }
  ],

  videos: [
  ]
};
