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
      title: "Project Hail Mary",
      author: "Andy Weir",
      finished: "2026-09",
      rating: 5,
      take: "Pure fun. The problem-solving rhythm is addictive, and the friendship at the center really lands."
    },
    {
      title: "Dune",
      author: "Frank Herbert",
      finished: "2026-08",
      rating: 5,
      take: "Slow first hundred pages, then it swallowed my week. The politics hold up better than the prophecy."
    },
    {
      title: "Thinking, Fast and Slow",
      author: "Daniel Kahneman",
      finished: "2026-06",
      rating: 4,
      take: "Changed how I notice my own snap judgments. Some studies have not replicated, so read it with a pinch of salt."
    },
    {
      title: "The Pragmatic Programmer",
      author: "Andrew Hunt & David Thomas",
      finished: "2026-03",
      rating: 4,
      take: "Half of it reads like common sense now, which is the point. The tracer-bullets idea stuck with me."
    },
    {
      title: "Sapiens",
      author: "Yuval Noah Harari",
      finished: "2026-01",
      rating: 3,
      take: "Big, bold, sometimes too confident. Great fuel for arguments over dinner."
    },
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
    },
    {
      title: "Interstellar",
      director: "Christopher Nolan",
      year: 2014,
      watched: "2026-07",
      rating: 5,
      take: "The docking scene still makes my hands sweat. Messy science, huge heart."
    },
    {
      title: "Spirited Away",
      director: "Hayao Miyazaki",
      year: 2001,
      watched: "2026-05",
      rating: 5,
      take: "Every frame is a painting. The train ride is the quietest, best scene in animation."
    },
    {
      title: "Arrival",
      director: "Denis Villeneuve",
      year: 2016,
      watched: "2026-04",
      rating: 4,
      take: "A linguistics movie disguised as an alien movie. The structure only clicks at the end."
    },
    {
      title: "The Matrix",
      director: "Lana & Lilly Wachowski",
      year: 1999,
      watched: "2026-02",
      rating: 5,
      take: "Holds up absurdly well. The lobby scene is still the gold standard."
    },
    {
      title: "Parasite",
      director: "Bong Joon-ho",
      year: 2019,
      watched: "2025-12",
      rating: 5,
      take: "Funny until it suddenly is not. The staircase shots say everything."
    }
  ],

  videos: [
    {
      title: "But what is a neural network?",
      channel: "3Blue1Brown",
      url: "https://www.youtube.com/watch?v=aircAruvnKk",
      watched: "2026-09",
      rating: 5,
      take: "The clearest intuition for layers and weights I have seen. The visuals do the teaching."
    },
    {
      title: "Let's build GPT: from scratch, in code, spelled out.",
      channel: "Andrej Karpathy",
      url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
      watched: "2026-08",
      rating: 5,
      take: "Two hours well spent. Typing along made attention finally feel concrete."
    },
    {
      title: "Optimistic Nihilism",
      channel: "Kurzgesagt",
      url: "https://www.youtube.com/watch?v=MBRqu0YOH14",
      watched: "2026-07",
      rating: 4,
      take: "Comforting in a strange way. A good one for a late-night rewatch."
    },
    {
      title: "The Most Misunderstood Concept in Physics",
      channel: "Veritasium",
      url: "https://www.youtube.com/watch?v=DxL2HoqLbyA",
      watched: "2026-06",
      rating: 4,
      take: "Entropy explained through the sun, not the messy room. It reframed the whole idea for me."
    }
  ]
};
