import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "password",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

/** Set inital tab view to 1 */
let currentUserId = 1;

/** Initialize User Array */
let users = [];

/** Render Current User Map */
async function checkVisited() {
  const result = await db.query("SELECT country_code FROM visited_countries JOIN users ON users.id = user_id WHERE user_id = $1; ",
  [currentUserId]);

  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });

  return countries;
}

/** Switch Current User */
async function checkCurrentUser(){
  const result = await db.query("SELECT * FROM users");
  let users = [];
  users = result.rows;

  if (!(users.find((user) => user.id == currentUserId))) {
    // If no user is found, handle it here (return a default user, set default color, etc.)
    return { id: -1, name: "Default User", color: "defaultColor" };
  }

  return users.find((user) => user.id == currentUserId);
 
}

/** Home View */
app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await checkCurrentUser();
  const userList = await db.query("SELECT * FROM users");


  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: userList.rows,
    color: currentUser.color
  });
});


/** Add Country To User List*/
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await checkCurrentUser();

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) ILIKE '%' || $1 || '%';",
      [input]
    );

    const data = result.rows[0];
    
    const countryCode = data.country_code;
    
    // Get the array of user's visited countries
    const visitedCountries = await db.query(
      "SELECT country_code FROM visited_countries WHERE user_id = $1",
      [currentUser.id]
    );

    // Extract the country codes from the result
    const userVisitedCountryCodes = visitedCountries.rows.map(row => row.country_code);

    // Check if the input country is already visited
    if (userVisitedCountryCodes.includes(countryCode)) {
      // Display alert message or log to console
      console.log("Country already visited");
      res.redirect("/");
    } else {
      // If not visited, insert into visited_countries
      try {
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [countryCode, currentUser.id]
        );

        res.redirect("/");
      } catch (err) {
        console.log(err);
      }
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


/** Add Family Member  */

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

/** Monitor Server */

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
