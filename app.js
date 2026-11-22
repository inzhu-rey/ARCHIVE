
const DB_NAME = "ARCHIVE_DB";
const STORE = "memories";

let db;
let memories = [];
let currentFilter = "all";
let selectedPhotos = [];
let selectedAudio = null;

const $ = id => document.getElementById(id);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore(STORE, { keyPath: "id" });
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
  memories = await databaseAction("readonly", s => s.getAll());
  renderMemories();
}

function openModal() {
  $("memoryForm").reset();
  selectedPhotos = [];
  selectedAudio = null;
  $("audioPreview").innerHTML = "";
  $("preview").innerHTML = "";
  $("memoryDate").value = new Date().toISOString().slice(0, 10);
  $("memoryModal").showModal();
}

function closeModal() {
  $("memoryModal").close();
}

$("photoInput").addEventListener("change", event => {
$("audioInput").addEventListener("change", event => {
  selectedAudio = event.target.files[0] || null;

  const preview = $("audioPreview");
  preview.innerHTML = "";

  if (selectedAudio) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = URL.createObjectURL(selectedAudio);

    preview.appendChild(audio);
  }
});
  selectedPhotos = Array.from(event.target.files);
  const preview = $("preview");
  preview.innerHTML = "";

  selectedPhotos.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
});

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
  ? selectedAudio.slice(0, selectedAudio.size, selectedAudio.type)
  : null,
    favorite: false,
    photos: selectedPhotos.map(file => file.slice(0, file.size, file.type))
  };

  try {
    await databaseAction("readwrite", (s, item) => s.put(item), memory);
    await loadMemories();
    closeModal();
    showToast("Memory successfully saved!");
  } catch (error) {
    console.error(error);
    showToast("Could not save memory. Try smaller photos.");
  }
});

function formatDate(date) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function renderMemories() {
  const grid = $("memoryGrid");
  const query = $("searchInput").value.toLowerCase().trim();

  let filtered = [...memories];

  if (currentFilter === "favorites") {
    filtered = filtered.filter(memory => memory.favorite);
  }

  if (query) {
    filtered = filtered.filter(memory =>
      [memory.title, memory.place, memory.note]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }

  filtered.sort((a, b) =>
    $("sortSelect").value === "newest"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date)
  );

  grid.innerHTML = "";
  $("memoryCount").textContent = String(memories.length).padStart(2, "0");

  $("emptyState").style.display = filtered.length ? "none" : "block";

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
    favorite.className = "favorite-btn" +
      (memory.favorite ? " active" : "");
    favorite.textContent = memory.favorite ? "♥" : "♡";

    favorite.onclick = async event => {
      event.stopPropagation();
      memory.favorite = !memory.favorite;
      await databaseAction("readwrite", s => s.put(memory));
      await loadMemories();
    };

    wrap.append(image, favorite);

    const meta = document.createElement("div");
    meta.className = "memory-meta";
    meta.innerHTML = `<span>${formatDate(memory.date)}</span>
      <span>${memory.photos.length} PHOTOS</span>`;

    const title = document.createElement("h3");
    title.textContent = memory.title;

    const place = document.createElement("p");
    place.textContent = memory.place || "Somewhere in time";

    card.append(wrap, meta, title, place);
    card.onclick = () => showDetails(memory.id);

    grid.appendChild(card);
  });
}

function setFilter(filter, button) {
  currentFilter = filter;

  document.querySelectorAll(".filter").forEach(item =>
    item.classList.remove("active")
  );

  button.classList.add("active");
  renderMemories();
}

function showDetails(id) {
  const memory = memories.find(item => item.id === id);
  if (!memory) return;

  const content = $("detailContent");
  content.innerHTML = "";

  const images = document.createElement("div");

  memory.photos.forEach(photo => {
    const image = document.createElement("img");
    image.className = "detail-image";
    image.src = URL.createObjectURL(photo);
    images.appendChild(image);
  });

  const title = document.createElement("h2");
  title.textContent = memory.title;

  const date = document.createElement("small");
  date.textContent = formatDate(memory.date);

  const note = document.createElement("p");
  note.textContent = memory.note;

  const place = document.createElement("p");
  place.textContent = memory.place;

  const actions = document.createElement("div");
  actions.className = "detail-actions";

  const favorite = document.createElement("button");
  favorite.className = "main-btn";
  favorite.textContent = memory.favorite
    ? "REMOVE FAVORITE"
    : "ADD TO FAVORITES";

  favorite.onclick = async () => {
    memory.favorite = !memory.favorite;
    await databaseAction("readwrite", s => s.put(memory));
    $("detailModal").close();
    await loadMemories();
  };

  const remove = document.createElement("button");
  remove.className = "main-btn";
  remove.textContent = "DELETE";

  remove.onclick = async () => {
    if (!confirm("Delete this memory?")) return;

    await databaseAction("readwrite", s => s.delete(id));
    $("detailModal").close();
    await loadMemories();
    showToast("Memory deleted.");
  };

  actions.append(favorite, remove);
  content.append(images, date, title, place, note, actions);

  $("detailModal").showModal();
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2500);
}

$("searchInput").addEventListener("input", renderMemories);
$("sortSelect").addEventListener("change", renderMemories);

(async function initialize() {
  try {
    db = await openDatabase();
    await loadMemories();
  } catch (error) {
    console.error(error);
    showToast("Storage is unavailable in this browser.");
  }
})();
