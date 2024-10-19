import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";  // Use the promise version

const app = express();
const port = 3000;

const db = await mysql.createConnection({
  host: "localhost",
  user: "root",
  database: "world",
  password: "",
  port: 3306,
});

// Connect to the database
try {
  await db.connect();
  console.log('Connected to the MySQL database!');
} catch (err) {
  console.error('Error connecting to the database:', err);
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

/** Set initial tab view to 1 */
let currentUserId = 1;

/** Render Current User Map */
async function checkVisited() {
  const [result] = await db.query("SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = ?;", [currentUserId]);

  let countries = result.map(country => country.country_code);
  return countries;
}

/** Switch Current User */
async function checkCurrentUser() {
  const [result] = await db.query("SELECT * FROM users");
  
  if (!(result.find(user => user.id == currentUserId))) {
    return { id: -1, name: "Default User", color: "defaultColor" };
  }

  return result.find(user => user.id == currentUserId);
}

/** Home View */
app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await checkCurrentUser();
  const [userList] = await db.query("SELECT * FROM users");

  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: userList,
    color: currentUser.color
  });
});

/** Add Country To User List */
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await checkCurrentUser();

  try {
    const [result] = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE LOWER(?)", 
      [`%${input}%`]
    );

    if (result.length === 0) {
      console.log("No country found");
      return res.redirect("/");
    }

    const countryCode = result[0].country_code;
    
    const [visitedCountries] = await db.query(
      "SELECT country_code FROM visited_countries WHERE user_id = ?", 
      [currentUser.id]
    );

    const userVisitedCountryCodes = visitedCountries.map(row => row.country_code);

    if (userVisitedCountryCodes.includes(countryCode)) {
      console.log("Country already visited");
      res.redirect("/");
    } else {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES (?, ?)",
        [countryCode, currentUser.id]
      );

      res.redirect("/");
    }
  } catch (err) {
    console.log(err);
  }
});

/** Switch View to New User Creation */
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

/** Add Family Member */
app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  try {
    // Insert the new user
    await db.query(
      "INSERT INTO users (name, color) VALUES(?, ?);",
      [name, color]
    );

    // Now query for the new user's ID
    const [result] = await db.query(
      "SELECT id FROM users WHERE name = ? AND color = ? ORDER BY id DESC LIMIT 1;",
      [name, color]
    );

    currentUserId = result[0].id; // Set the current user ID to the newly added user's ID

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding user.");
  }
});


/** Monitor Server */
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
