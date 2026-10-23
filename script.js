"use strict";

const STORAGE_KEY = "interview-study-planner-progress-v1";
const TOTAL_QUESTIONS = 466;

const subjects = [
  {
    id: "oops",
    name: "OOPs Fundamentals",
    total: 40,
    dailyCount: () => 2,
    color: "#8974dc",
    tint: "#f1edff",
  },
  {
    id: "python",
    name: "Top 100 Python Questions",
    total: 100,
    dailyCount: () => 5,
    color: "#e4a664",
    tint: "#fff4e9",
  },
  {
    id: "advanced-python",
    name: "Advanced Python Questions",
    total: 40,
    dailyCount: () => 2,
    color: "#66ad91",
    tint: "#eaf6ef",
  },
  {
    id: "os",
    name: "Operating Systems",
    total: 106,
    dailyCount: (day) => (day <= 6 ? 6 : 5),
    color: "#708ed7",
    tint: "#edf2ff",
  },
  {
    id: "dbms-sql",
    name: "DBMS + SQL",
    total: 140,
    dailyCount: () => 7,
    color: "#d47f9a",
    tint: "#fff0f4",
  },
  {
    id: "hr",
    name: "HR Questions",
    total: 40,
    dailyCount: () => 2,
    color: "#63a7bb",
    tint: "#eaf6f8",
  },
];

const dayNames = [
  "A fresh start",
  "Build your rhythm",
  "Keep the momentum",
  "One step stronger",
  "You're doing great",
  "A week of progress",
  "Find your flow",
  "Keep showing up",
  "Steady and focused",
  "Halfway to your goal",
  "Look how far you've come",
  "Keep that spark",
  "Growing every day",
  "You've got this",
  "Stay curious",
  "Your effort is adding up",
  "Almost there",
  "Keep believing",
  "Final stretch",
  "Your big finish",
];

const dayGrid = document.querySelector("#day-grid");
const subjectProgressGrid = document.querySelector("#subject-progress-grid");
const storageMessage = document.querySelector("#storage-message");
const emptyFilter = document.querySelector("#empty-filter");

let progress = {};
let storageReady = true;
let activeFilter = "all";
let highlightTimer;

function buildSchedule() {
  const nextQuestion = Object.fromEntries(subjects.map((subject) => [subject.id, 1]));
  const days = Array.from({ length: 20 }, (_, index) => {
    const dayNumber = index + 1;
    const tasks = subjects.map((subject) => {
      const first = nextQuestion[subject.id];
      const count = subject.dailyCount(dayNumber);
      const last = first + count - 1;
      nextQuestion[subject.id] = last + 1;
      return { subjectId: subject.id, first, last, count };
    });
    return { number: dayNumber, title: dayNames[index], tasks };
  });

  for (const subject of subjects) {
    if (nextQuestion[subject.id] - 1 !== subject.total) {
      throw new Error(`The ${subject.name} schedule does not total ${subject.total} questions.`);
    }
  }

  const scheduledTotal = subjects.reduce((sum, subject) => sum + subject.total, 0);
  if (scheduledTotal !== TOTAL_QUESTIONS) {
    throw new Error(`The study plan must total ${TOTAL_QUESTIONS} questions.`);
  }

  return days;
}

const days = buildSchedule();

function taskKey(dayNumber, subjectId) {
  return `${dayNumber}:${subjectId}`;
}

function isTaskComplete(dayNumber, subjectId, fromProgress = progress) {
  return fromProgress[taskKey(dayNumber, subjectId)] === true;
}

function showStorageError(message) {
  storageMessage.textContent = message;
  storageMessage.hidden = false;
}

function hideStorageError() {
  storageMessage.textContent = "";
  storageMessage.hidden = true;
}

function loadProgress() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return {};
    }

    const parsed = JSON.parse(stored);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      parsed.version !== 1 ||
      parsed.completed === null ||
      typeof parsed.completed !== "object" ||
      Array.isArray(parsed.completed)
    ) {
      throw new Error("The saved progress has an unsupported format.");
    }

    const restored = {};
    for (const day of days) {
      for (const task of day.tasks) {
        const key = taskKey(day.number, task.subjectId);
        if (parsed.completed[key] === true) {
          restored[key] = true;
        }
      }
    }
    return restored;
  } catch (error) {
    storageReady = false;
    const detail = error instanceof Error ? error.message : "Unknown storage error.";
    showStorageError(
      `Your saved progress could not be loaded (${detail}). It has not been overwritten. ` +
        "Reload after resolving the browser storage issue, or use Reset progress to clear this planner's saved data."
    );
    return {};
  }
}

function saveProgress(nextProgress) {
  if (!storageReady) {
    return false;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, completed: nextProgress })
    );
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown storage error.";
    showStorageError(`Progress could not be saved (${detail}). Your previous saved progress is unchanged.`);
    return false;
  }
}

function makeSubjectProgressCards() {
  subjectProgressGrid.innerHTML = subjects
    .map(
      (subject) => `
        <article class="subject-card" style="--subject-color: ${subject.color}; --subject-tint: ${subject.tint}">
          <div class="subject-card-top">
            <div class="subject-name-wrap">
              <span class="subject-dot" aria-hidden="true"></span>
              <h3>${subject.name}</h3>
            </div>
            <span class="subject-percent" id="subject-percent-${subject.id}">0%</span>
          </div>
          <div
            class="progress-track"
            role="progressbar"
            aria-label="${subject.name} completion"
            aria-valuemin="0"
            aria-valuemax="${subject.total}"
            aria-valuenow="0"
            id="subject-bar-${subject.id}"
          >
            <span class="progress-fill" id="subject-fill-${subject.id}"></span>
          </div>
          <div class="subject-meta">
            <span id="subject-count-${subject.id}">0 / ${subject.total} questions</span>
            <span>${subject.total} total</span>
          </div>
        </article>
      `
    )
    .join("");
}

function makeDayCard(day) {
  const allTasksComplete = day.tasks.every((task) => isTaskComplete(day.number, task.subjectId));
  const completedCount = day.tasks.filter((task) => isTaskComplete(day.number, task.subjectId)).length;
  const taskMarkup = day.tasks
    .map((task) => {
      const subject = subjects.find((item) => item.id === task.subjectId);
      const id = `task-${day.number}-${task.subjectId}`;
      return `
        <label class="subject-task" for="${id}" style="--subject-color: ${subject.color}; --subject-tint: ${subject.tint}">
          <span class="task-main">
            <input
              class="task-checkbox"
              id="${id}"
              type="checkbox"
              data-day="${day.number}"
              data-subject="${subject.id}"
              ${isTaskComplete(day.number, subject.id) ? "checked" : ""}
              ${storageReady ? "" : "disabled"}
            />
            <span class="checkmark" aria-hidden="true">✓</span>
            <span class="task-name">${subject.name}</span>
          </span>
          <span class="task-range">Q${task.first}–${task.last}</span>
        </label>
      `;
    })
    .join("");

  return `
    <article class="day-card${allTasksComplete ? " is-complete" : ""}" id="day-card-${day.number}" data-day-card="${day.number}">
      <header class="day-card-header">
        <div class="day-heading-group">
          <span class="day-number-badge">${String(day.number).padStart(2, "0")}</span>
          <div>
            <h3 class="day-title">Day ${day.number}</h3>
            <p class="day-subtitle">${day.title}</p>
          </div>
        </div>
        <span class="day-progress-label">
          <span class="day-status-dot" aria-hidden="true"></span>
          <span data-day-count="${day.number}">${completedCount} / 6 subjects</span>
        </span>
      </header>
      <div class="progress-track day-progress-track" aria-hidden="true">
        <span class="progress-fill" data-day-fill="${day.number}" style="width: ${(completedCount / 6) * 100}%"></span>
      </div>
      <div class="day-subject-list">${taskMarkup}</div>
    </article>
  `;
}

function makeDayCards() {
  dayGrid.innerHTML = days.map(makeDayCard).join("");
}

function completedQuestionCount(fromProgress = progress) {
  let total = 0;
  for (const day of days) {
    for (const task of day.tasks) {
      if (isTaskComplete(day.number, task.subjectId, fromProgress)) {
        total += task.count;
      }
    }
  }
  return total;
}

function completedDayCount(fromProgress = progress) {
  return days.filter((day) =>
    day.tasks.every((task) => isTaskComplete(day.number, task.subjectId, fromProgress))
  ).length;
}

function updateMotivation(percent) {
  const message =
    percent === 100
      ? "Every single question — what an incredible achievement!"
      : percent >= 75
        ? "The finish line is in sight. Keep that wonderful momentum!"
        : percent >= 50
          ? "More than halfway there. You're doing something amazing."
          : percent >= 25
            ? "Your consistency is paying off. Keep showing up for yourself."
            : percent > 0
              ? "A lovely start — every checked box is real progress."
              : "Your journey starts with one small step. You've got this!";
  document.querySelector("#motivation-message").textContent = message;
}

function updateDashboard() {
  const completedQuestions = completedQuestionCount();
  const remainingQuestions = TOTAL_QUESTIONS - completedQuestions;
  const percent = Math.round((completedQuestions / TOTAL_QUESTIONS) * 100);

  document.querySelector("#completion-percent").textContent = String(percent);
  document.querySelector("#completed-questions").textContent = String(completedQuestions);
  document.querySelector("#completed-stat").textContent = String(completedQuestions);
  document.querySelector("#remaining-stat").textContent = String(remainingQuestions);
  document.querySelector("#completed-days").textContent = String(completedDayCount());

  const overallProgress = document.querySelector("#overall-progress");
  overallProgress.setAttribute("aria-valuenow", String(completedQuestions));
  overallProgress.setAttribute("aria-valuetext", `${percent}% complete`);
  document.querySelector("#overall-progress-fill").style.width = `${percent}%`;

  for (const subject of subjects) {
    let subjectCompleted = 0;
    for (const day of days) {
      const task = day.tasks.find((item) => item.subjectId === subject.id);
      if (isTaskComplete(day.number, subject.id)) {
        subjectCompleted += task.count;
      }
    }
    const subjectPercent = Math.round((subjectCompleted / subject.total) * 100);
    const bar = document.querySelector(`#subject-bar-${subject.id}`);
    bar.setAttribute("aria-valuenow", String(subjectCompleted));
    bar.setAttribute("aria-valuetext", `${subjectPercent}% complete`);
    document.querySelector(`#subject-fill-${subject.id}`).style.width = `${subjectPercent}%`;
    document.querySelector(`#subject-percent-${subject.id}`).textContent = `${subjectPercent}%`;
    document.querySelector(`#subject-count-${subject.id}`).textContent =
      `${subjectCompleted} / ${subject.total} questions`;
  }

  for (const day of days) {
    const completedTasks = day.tasks.filter((task) => isTaskComplete(day.number, task.subjectId)).length;
    const card = document.querySelector(`#day-card-${day.number}`);
    card.classList.toggle("is-complete", completedTasks === subjects.length);
    document.querySelector(`[data-day-count="${day.number}"]`).textContent =
      `${completedTasks} / ${subjects.length} subjects`;
    document.querySelector(`[data-day-fill="${day.number}"]`).style.width =
      `${(completedTasks / subjects.length) * 100}%`;
  }

  document.querySelector("#celebration-card").hidden = completedQuestions !== TOTAL_QUESTIONS;
  updateMotivation(percent);
}

function applyFilter(filter) {
  activeFilter = filter;
  let visibleDays = 0;

  for (const day of days) {
    const card = document.querySelector(`#day-card-${day.number}`);
    const isComplete = day.tasks.every((task) => isTaskComplete(day.number, task.subjectId));
    const shouldShow =
      filter === "all" || (filter === "completed" ? isComplete : !isComplete);
    card.hidden = !shouldShow;
    if (shouldShow) {
      visibleDays += 1;
    }
  }

  emptyFilter.hidden = visibleDays !== 0;
  for (const button of document.querySelectorAll(".filter-button")) {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function continueStudying() {
  const nextDay = days.find((day) =>
    day.tasks.some((task) => !isTaskComplete(day.number, task.subjectId))
  );

  if (!nextDay) {
    document.querySelector("#celebration-card").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (activeFilter !== "all") {
    applyFilter("all");
  }

  const target = document.querySelector(`#day-card-${nextDay.number}`);
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.remove("is-highlighted");
  window.clearTimeout(highlightTimer);
  window.requestAnimationFrame(() => target.classList.add("is-highlighted"));
  highlightTimer = window.setTimeout(() => target.classList.remove("is-highlighted"), 2200);
}

function handleTaskChange(event) {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.matches(".task-checkbox")) {
    return;
  }

  const key = taskKey(Number(checkbox.dataset.day), checkbox.dataset.subject);
  const nextProgress = { ...progress };
  if (checkbox.checked) {
    nextProgress[key] = true;
  } else {
    delete nextProgress[key];
  }

  if (!saveProgress(nextProgress)) {
    checkbox.checked = !checkbox.checked;
    return;
  }

  progress = nextProgress;
  updateDashboard();
  applyFilter(activeFilter);
}

function resetProgress() {
  const confirmed = window.confirm(
    "Reset all interview preparation progress on this device? This cannot be undone."
  );
  if (!confirmed) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown storage error.";
    showStorageError(`Progress could not be reset (${detail}). Your saved progress is unchanged.`);
    return;
  }

  progress = {};
  storageReady = true;
  hideStorageError();
  makeDayCards();
  updateDashboard();
  applyFilter(activeFilter);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initialize() {
  progress = loadProgress();
  makeSubjectProgressCards();
  makeDayCards();
  updateDashboard();
  applyFilter("all");

  dayGrid.addEventListener("change", handleTaskChange);
  document.querySelector("#continue-button").addEventListener("click", continueStudying);
  document.querySelector("#reset-button").addEventListener("click", resetProgress);
  for (const button of document.querySelectorAll(".filter-button")) {
    button.addEventListener("click", () => applyFilter(button.dataset.filter));
  }
}

initialize();
