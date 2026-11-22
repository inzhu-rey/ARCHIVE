
const DB_NAME = "ARCHIVE_DB";
const STORE = "memories";

let db;
let memories = [];
let currentFilter = "all";
let selectedPhotos = [];
let selectedAudio = null;

const $ = id => document.getElementById(id);

// DATABASE

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, {
          keyPath: "id"
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function databaseAction(mode, action, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = action(store, data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadMemories() {
  memories = await databaseAction(
    "readonly",
    store => store.getAll()
  );

  renderMemories();
}

// MODAL

function openModal() {
  $("memoryForm").reset();

  selectedPhotos = [];
  selectedAudio = null;

  $("preview").innerHTML = "";
  $("audioPreview").innerHTML = "";

  $("memoryDate").value =
    new Date().toISOString().slice(0, 10);

  $("memoryModal").showModal();
}

function closeModal() {
  $("memoryModal").close();
}

// PHOTO UPLOAD

$("photoInput").addEventListener("change", event => {
  selectedPhotos = Array.from(event.target.files);

  const preview = $("preview");
  preview.innerHTML = "";

  selectedPhotos.forEach(file => {
    const image = document.createElement("img");

    image.src = URL.createObjectURL(file);
    image.alt = "Selected memory photo";

    preview.appendChild(image);
  });
});

// AUDIO UPLOAD

$("audioInput").addEventListener("change", event => {
  selectedAudio = event.target.files[0] || null;

  const preview = $("audioPreview");
  preview.innerHTML = "";

  if (selectedAudio) {
    const audio = document.createElement("audio");

    audio.controls = true;
    audio.preload = "metadata";
    audio.src = URL.createObjectURL(selectedAudio);

    preview.appendChild(audio);
  }
});

// SAVE MEMORY

$("memoryForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!selectedPhotos.length) {
    showToast("Choose at least one photo!");
    return;
  }

  const memory = {
    id: crypto.randomUUID(),

    title: $("memoryTitle").value.trim(),
    date: $("memoryDate").value,
    place: $("memoryPlace").value.trim(),
    note: $("memoryNote").value.trim(),

    songTitle: $("songTitle").value.trim(),
    songArtist: $("songArtist").value.trim(),

    audio: selectedAudio
      ? selectedAudio.slice(
          0,
          selectedAudio.size,
          selectedAudio.type
        )
      : null,

    favorite: false,

    photos: selectedPhotos.map(file =>
      file.slice(0, file.size, file.type)
    )
  };

  try {
    await databaseAction(
      "readwrite",
      (store, item) => store.put(item),
      memory
    );

    await loadMemories();

    closeModal();
    showToast("Memory successfully saved!");

  } catch (error) {
    console.error(error);
    showToast("Could not save memory. Try smaller files.");
  }
});

// DATE FORMAT

function formatDate(date) {
  if (!date) return "";

  return new Date(date + "T12:00:00")
    .toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
}

// RENDER MEMORIES

function renderMemories() {
  const grid = $("memoryGrid");

  const query = $("searchInput")
    .value.toLowerCase().trim();

  let filtered = [...memories];

  if (currentFilter === "favorites") {
    filtered = filtered.filter(memory => memory.favorite);
  }

  if (query) {
    filtered = filtered.filter(memory =>
      [
        memory.title,
        memory.place,
        memory.note,
        memory.songTitle,
        memory.songArtist
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  filtered.sort((a, b) => {
    return $("sortSelect").value === "newest"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date);
  });

  grid.innerHTML = "";

  $("memoryCount").textContent =
    String(memories.length).padStart(2, "0");

  $("emptyState").style.display =
    filtered.length ? "none" : "block";

  filtered.forEach(memory => {
    const card = document.createElement("article");
    card.className = "memory-card";

    const wrap = document.createElement("div");
    wrap.className = "memory-image-wrap";

    const image = document.createElement("img");
    image.className = "memory-image";
    image.src = URL.createObjectURL(memory.photos[0]);
    image.alt = memory.title;

    const favorite = document.createElement("button");

    favorite.className =
      "favorite-btn" +
      (memory.favorite ? " active" : "");

    favorite.textContent =
      memory.favorite ? "♥" : "♡";

    favorite.type = "button";

    favorite.onclick = async event => {
      event.stopPropagation();

      memory.favorite = !memory.favorite;

      await databaseAction(
        "readwrite",
        store => store.put(memory)
      );

      await loadMemories();
    };

    wrap.append(image, favorite);

    const meta = document.createElement("div");
    meta.className = "memory-meta";

    const dateText = document.createElement("span");
    dateText.textContent = formatDate(memory.date);

    const photoCount = document.createElement("span");
    photoCount.textContent =
      memory.photos.length + " PHOTOS";

    meta.append(dateText, photoCount);

    const title = document.createElement("h3");
    title.textContent = memory.title;

    const place = document.createElement("p");
    place.textContent =
      memory.place || "Somewhere in time";

    card.append(wrap, meta, title, place);

    card.onclick = () => showDetails(memory.id);

    grid.appendChild(card);
  });
}

// FILTERS

function setFilter(filter, button) {
  currentFilter = filter;

  document.querySelectorAll(".filter").forEach(item => {
    item.classList.remove("active");
  });

  button.classList.add("active");

  renderMemories();
}

// MEMORY DETAILS

function showDetails(id) {
  const memory = memories.find(item => item.id === id);

  if (!memory) return;

  const content = $("detailContent");
  content.innerHTML = "";

  // PHOTOS

  const images = document.createElement("div");

  memory.photos.forEach(photo => {
    const image = document.createElement("img");

    image.className = "detail-image";
    image.src = URL.createObjectURL(photo);
    image.alt = memory.title;

    images.appendChild(image);
  });

  // DATE

  const date = document.createElement("small");
  date.textContent = formatDate(memory.date);

  // TITLE

  const title = document.createElement("h2");
  title.textContent = memory.title;

  // LOCATION

  const place = document.createElement("p");
  place.textContent = memory.place;

  // STORY

  const note = document.createElement("p");
  note.textContent = memory.note;

  content.append(
    images,
    date,
    title,
    place,
    note
  );

  // MUSIC PLAYER

  if (memory.audio) {
    const musicPlayer = document.createElement("div");

    musicPlayer.className = "music-player";

    const label = document.createElement("p");
    label.className = "eyebrow";
    label.textContent = "SOUNDTRACK OF THIS MEMORY";

    const song = document.createElement("h3");
    song.textContent =
      memory.songTitle || "Untitled song";

    const artist = document.createElement("p");
    artist.textContent =
      memory.songArtist || "Unknown artist";

    const audio = document.createElement("audio");

    audio.controls = true;
    audio.preload = "metadata";
    audio.src = URL.createObjectURL(memory.audio);

    musicPlayer.append(
      label,
      song,
      artist,
      audio
    );

    content.appendChild(musicPlayer);
  }

  // ACTION BUTTONS

  const actions = document.createElement("div");
  actions.className = "detail-actions";

  const favorite = document.createElement("button");

  favorite.className = "main-btn";
  favorite.type = "button";

  favorite.textContent = memory.favorite
    ? "REMOVE FAVORITE"
    : "ADD TO FAVORITES";

  favorite.onclick = async () => {
    memory.favorite = !memory.favorite;

    await databaseAction(
      "readwrite",
      store => store.put(memory)
    );

    $("detailModal").close();

    await loadMemories();
  };

  const remove = document.createElement("button");

  remove.className = "main-btn";
  remove.type = "button";
  remove.textContent = "DELETE";

  remove.onclick = async () => {
    if (!confirm("Delete this memory?")) return;

    await databaseAction(
      "readwrite",
      store => store.delete(id)
    );

    $("detailModal").close();

    await loadMemories();

    showToast("Memory deleted.");
  };

  actions.append(favorite, remove);

  content.appendChild(actions);

  $("detailModal").showModal();
}

// TOAST

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// SEARCH AND SORT

$("searchInput").addEventListener(
  "input",
  renderMemories
);

$("sortSelect").addEventListener(
  "change",
  renderMemories
);

// INITIALIZE

(async function initialize() {
  try {
    db = await openDatabase();
    await loadMemories();

  } catch (error) {
    console.error(error);
    showToast("Storage is unavailable in this browser.");
  }
})();
