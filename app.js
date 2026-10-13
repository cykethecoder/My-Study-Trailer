// Import required modules
const express = require('express');

// Create an Express application
const app = express();

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Allow Express to access files inside resources folder
app.use(express.static('resources'));


// User profile (null until the user completes the 'Get to know you' modal)
let userProfile = null;

// In-memory array to store study sessions
let studySessions = [];


// In-memory array to store modules
let modules = [
    {
        moduleCode: "C237",
        moduleName: "Software Application Development",
        currentGrade: "No Grade Yet",
        yearSemester: "Year 2 Semester 1"
    },
    {
        moduleCode: "C335",
        moduleName: "Network Security",
        currentGrade: "No Grade Yet",
        yearSemester: "Year 2 Semester 1"
    },

    {
        moduleCode: "C229",
        moduleName: "Operating Systems & Cloud Computing",
        currentGrade: "No Grade Yet",
        yearSemester: "Year 2 Semester 1"
    },

    {
        moduleCode: "C376",
        moduleName: "Governance Risk Compliance & Data Protection",
        currentGrade: "No Grade Yet",
        yearSemester: "Year 2 Semester 1"
    },

    {
        moduleCode: "C206",
        moduleName: "Software Development Process",
        currentGrade: "A",
        yearSemester: "Year 1 Semester 2"
    }
];

// In-memory array to store study goals
let studyGoals = [];

// Function to convert focus rating number into text
function getFocusLabel(rating) {
    if (rating == 1) {
        return "Very Low";
    } else if (rating == 2) {
        return "Low";
    } else if (rating == 3) {
        return "Average";
    } else if (rating == 4) {
        return "Good";
    } else {
        return "Excellent";
    }
}


// Function to get the next semester in sequence
function getNextSemester(current) {
    const order = [
        "Year 1 Semester 1", "Year 1 Semester 2",
        "Year 2 Semester 1", "Year 2 Semester 2",
        "Year 3 Semester 1", "Year 3 Semester 2"
    ];
    const idx = order.indexOf(current);
    return idx !== -1 && idx < order.length - 1 ? order[idx + 1] : current;
}

// Auto-advance semester when today (SGT) is past the user's 'To' date
app.use((req, res, next) => {
    if (userProfile && userProfile.toMonth && userProfile.toYear) {
        // Last day of toMonth (month is 1-indexed, so new Date(year, month, 0) = last day of toMonth)
        const toDate = new Date(parseInt(userProfile.toYear), parseInt(userProfile.toMonth), 0);
        const sgtNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const todayUTC = Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate());

        if (todayUTC > toDate.getTime()) {
            userProfile.yearSemester = getNextSemester(userProfile.yearSemester);
            // Clear from/to so the check doesn't fire again until user updates profile
            userProfile.fromMonth = null;
            userProfile.fromYear  = null;
            userProfile.toMonth   = null;
            userProfile.toYear    = null;
        }
    }
    next();
});

// Dashboard
app.get("/", (req, res) => {
    const totalGoals = studyGoals.length; // Goal statistics
    const completedGoals = studyGoals.filter(goal => goal.status === "Completed").length;
    const notStartedGoals = studyGoals.filter(goal => goal.status === "Not Started").length;
    const inProgressGoals = studyGoals.filter(goal => goal.status === "In Progress").length;

    // Find the next upcoming exam across all important dates
    // Compute "today" in Singapore Time (UTC+8) as a UTC midnight value
    // so that comparisons against exam date strings (parsed as UTC midnight) are correct
    const nowUtc = new Date();
    const sgtNow = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000);
    const today = new Date(Date.UTC(sgtNow.getUTCFullYear(), sgtNow.getUTCMonth(), sgtNow.getUTCDate()));

    const upcomingExams = importantDates
        .filter(e => new Date(e.examDate) >= today)
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

    const nextExam = upcomingExams.length > 0 ? upcomingExams[0] : null;

    // Attach days-remaining to each upcoming exam
    const upcomingExamsWithDays = upcomingExams.map(e => {
        const diffMs = new Date(e.examDate) - today;
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { ...e, daysLeft };
    });

    res.render("index", {
        sessions: studySessions,

        totalGoals: totalGoals,
        completedGoals: completedGoals,
        notStartedGoals: notStartedGoals,
        inProgressGoals: inProgressGoals,

        userProfile: userProfile,
        nextExam: nextExam,
        upcomingExams: upcomingExamsWithDays
    });

});


// Save user profile from 'Get to know you' modal
app.post("/saveProfile", (req, res) => {
    userProfile = {
        name: req.body.name,
        yearSemester: req.body.yearSemester,
        diploma: req.body.diploma,
        fromMonth: req.body.fromMonth || null,
        fromYear:  req.body.fromYear  || null,
        toMonth:   req.body.toMonth   || null,
        toYear:    req.body.toYear    || null
    };
    res.redirect("/");
});

// Show edit profile page
app.get("/editProfile", (req, res) => {
    res.render("editProfile", {
        userProfile: userProfile
    });
});

// View all study sessions
app.get("/sessions", (req, res) => {
    const sessionsWithIndex = studySessions.map((s, i) => ({ ...s, index: i }));
    res.render("sessions", {
        sessions: sessionsWithIndex,
        getFocusLabel: getFocusLabel,
        userProfile: userProfile
    });
});


// Add session form page
app.get("/addSession", (req, res) => {
    res.render("addSession", {
        modules: modules,
        userProfile: userProfile
    });
});


// When add session form is submitted
app.post("/addSession", (req, res) => {
    const newSession = {
        subject: req.body.subject,
        date: req.body.date,
        duration: req.body.duration,
        focusRating: req.body.focusRating,
        reflection: req.body.reflection,
        imageUrl: req.body.imageUrl,
        yearSemester: req.body.yearSemester
    };

    studySessions.push(newSession);

    res.redirect("/sessions");
});


// Details page for one session
app.get("/details/:id", (req, res) => {
    const id = req.params.id;

    res.render("details", {
        session: studySessions[id],
        id: id,
        getFocusLabel: getFocusLabel
    });
});


// Edit session form page
app.get("/editSessions/:id", (req, res) => {
    const id = req.params.id;

    res.render("editSessions", {
        session: studySessions[id],
        id: id,
        modules: modules,
        userProfile: userProfile
    });
});


// When edit session form is submitted
app.post("/editSessions/:id", (req, res) => {
    const id = req.params.id;

    studySessions[id] = {
        subject: req.body.subject,
        date: req.body.date,
        duration: req.body.duration,
        focusRating: req.body.focusRating,
        reflection: req.body.reflection,
        imageUrl: req.body.imageUrl,
        yearSemester: req.body.yearSemester
    };

    res.redirect("/sessions");
});


// Delete a study session
app.get("/deleteSession/:id", (req, res) => {
    const id = req.params.id;

    studySessions.splice(id, 1);

    res.redirect("/sessions");
});

// Search and filter study sessions
app.get("/searchSessions", (req, res) => {

    const moduleCode = req.query.moduleCode;
    const date = req.query.date;
    const duration = req.query.duration;
    const focusRating = req.query.focusRating;

    let filteredSessions = studySessions;

    // Filter by module code
    if (moduleCode) {
        filteredSessions = filteredSessions.filter(session =>
            session.subject.toLowerCase().includes(moduleCode.toLowerCase())
        );
    }

    // Filter by date
    if (date) {
        filteredSessions = filteredSessions.filter(session =>
            session.date === date
        );
    }

    // Filter by duration
    if (duration) {
        filteredSessions = filteredSessions.filter(session =>
            session.duration == duration
        );
    }

    // Filter by focus rating
    if (focusRating) {
        filteredSessions = filteredSessions.filter(session =>
            session.focusRating == focusRating
        );
    }

    res.render("sessions", {
        sessions: filteredSessions.map((s, i) => ({
            ...s,
            index: studySessions.indexOf(s)
        })),
        getFocusLabel: getFocusLabel,
        userProfile: userProfile
    });

});

// =====================
// MODULES SECTION
// =====================

// View all modules
app.get("/modules", (req, res) => {
    const modulesWithIndex = modules.map((m, i) => ({ ...m, index: i }));
    res.render("modules", {
        modules: modulesWithIndex,
        userProfile: userProfile
    });
});


// Add module form page
app.get("/addModule", (req, res) => {
    res.render("addModule", {
        userProfile: userProfile
    });
});


// When add module form is submitted
app.post("/addModule", (req, res) => {
    const newModule = {
        moduleCode: req.body.moduleCode,
        moduleName: req.body.moduleName,
        currentGrade: req.body.currentGrade,
        yearSemester: req.body.yearSemester
    };

    modules.push(newModule);

    res.redirect("/modules");
});


// Edit module form page
app.get("/editModule/:id", (req, res) => {
    const id = req.params.id;

    res.render("editModule", {
        module: modules[id],
        id: id,
        userProfile: userProfile
    });
});


// When edit module form is submitted
app.post("/editModule/:id", (req, res) => {
    const id = req.params.id;

    modules[id] = {
        moduleCode: req.body.moduleCode,
        moduleName: req.body.moduleName,
        currentGrade: req.body.currentGrade,
        yearSemester: req.body.yearSemester
    };

    res.redirect("/modules");
});


// Delete module
app.get("/deleteModule/:id", (req, res) => {
    const id = req.params.id;

    modules.splice(id, 1);

    res.redirect("/modules");
});

// Search modules by module code
app.get("/searchModules", (req, res) => {

    const moduleCode = req.query.moduleCode;

    let filteredModules = modules;

    // Filter module code
    if (moduleCode) {

        filteredModules = filteredModules.filter(moduleItem =>
            moduleItem.moduleCode.toLowerCase()
            .includes(moduleCode.toLowerCase())
        );
    }

    res.render("modules", {
        modules: filteredModules.map(m => ({ ...m, index: modules.indexOf(m) })),
        userProfile: userProfile
    });

});
// =====================
// STUDY GOALS SECTION
// =====================

// View all study goals
app.get("/goals", (req, res) => {
    const goalsWithIndex = studyGoals.map((g, i) => ({ ...g, index: i }));
    res.render("goals", {
        goals: goalsWithIndex,
        userProfile: userProfile
    });
});

// Goal details page
app.get("/goalDetails/:id", (req, res) => {

    const id = req.params.id;

    res.render("goalDetails", {
        goal: studyGoals[id],
        id: id
    });

});

// Add goal form page
app.get("/addGoal", (req, res) => {
    res.render("addGoal", {
        modules: modules,
        userProfile: userProfile
    });
});

// When add goal form is submitted
app.post("/addGoal", (req, res) => {
    const newGoal = {
        goalTitle: req.body.goalTitle,
        relatedModule: req.body.relatedModule,
        targetDate: req.body.targetDate,
        status: req.body.status,
        description: req.body.description,
        yearSemester: req.body.yearSemester
    };

    studyGoals.push(newGoal);

    res.redirect("/goals");
});

// Edit goal form page
app.get("/editGoal/:id", (req, res) => {
    const id = req.params.id;

    res.render("editGoal", {
        goal: studyGoals[id],
        id: id,
        modules: modules,
        userProfile: userProfile
    });
});

// When edit goal form is submitted
app.post("/editGoal/:id", (req, res) => {
    const id = req.params.id;

    studyGoals[id] = {
        goalTitle: req.body.goalTitle,
        relatedModule: req.body.relatedModule,
        targetDate: req.body.targetDate,
        status: req.body.status,
        description: req.body.description,
        yearSemester: req.body.yearSemester
    };

    res.redirect("/goals");
});

// Delete goal
app.get("/deleteGoal/:id", (req, res) => {
    const id = req.params.id;

    studyGoals.splice(id, 1);

    res.redirect("/goals");
});

// Search and filter study goals
app.get("/searchGoals", (req, res) => {

    const moduleKeyword = req.query.moduleKeyword;
    const status = req.query.status;

    let filteredGoals = studyGoals;

    // Filter by related module code or name
    if (moduleKeyword) {
        filteredGoals = filteredGoals.filter(goal =>
            goal.relatedModule.toLowerCase().includes(moduleKeyword.toLowerCase())
        );
    }

    // Filter by goal status
    if (status) {
        filteredGoals = filteredGoals.filter(goal =>
            goal.status === status
        );
    }

    res.render("goals", {
        goals: filteredGoals.map(g => ({ ...g, index: studyGoals.indexOf(g) })),
        userProfile: userProfile
    });

});

// =====================
// IMPORTANT DATES SECTION
// =====================

// In-memory array to store important dates
let importantDates = [];

// View all important dates, grouped by year & semester
app.get("/importantDates", (req, res) => {

    // Group entries by yearSemester
    const grouped = {};
    importantDates.forEach((entry, index) => {
        const key = entry.yearSemester;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push({ ...entry, index });
    });

    res.render("importantDates", {
        grouped: grouped,
        userProfile: userProfile
    });
});

// Add important date form page
app.get("/addImportantDate", (req, res) => {
    const sgtNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const today = sgtNow.toISOString().split("T")[0];
    res.render("addImportantDate", {
        today: today,
        modules: modules,
        userProfile: userProfile
    });
});

// When add important date form is submitted
app.post("/addImportantDate", (req, res) => {
    const newEntry = {
        module: req.body.module,
        lessonsCovered: req.body.lessonsCovered,
        examDate: req.body.examDate,
        examType: req.body.examType,
        yearSemester: req.body.yearSemester
    };

    importantDates.push(newEntry);

    res.redirect("/importantDates");
});

// Delete an important date
app.get("/deleteImportantDate/:id", (req, res) => {
    const id = req.params.id;
    importantDates.splice(id, 1);
    res.redirect("/importantDates");
});

// Edit an important date
app.post("/editImportantDate/:id", (req, res) => {
    const id = req.params.id;
    importantDates[id] = {
        module: req.body.module,
        lessonsCovered: req.body.lessonsCovered,
        examDate: req.body.examDate,
        examType: req.body.examType,
        yearSemester: req.body.yearSemester
    };
    res.redirect("/importantDates");
});

// Start the server
const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});