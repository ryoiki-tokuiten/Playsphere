# PlaySphere Backend & Client

This project is a web application with a React frontend and a Node.js (Express) backend. It uses PostgreSQL for the database and Drizzle ORM for database interactions.

## Project Structure

*   **/client**: Contains the React frontend application.
*   **/server**: Contains the Node.js/Express backend application.
*   **/shared**: Contains shared code, primarily the Drizzle ORM schema (`schema.ts`).
*   **/drizzle**: Drizzle ORM's migration working directory.
*   **/uploads**: Directory for user-uploaded content (images).
*   `setup_database.sql`: SQL script to initialize the database schema.
*   `.env`: Root configuration file for environment variables.

## Setup Instructions

### 1. Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js)
*   PostgreSQL server

### 2. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Environment Configuration

Create a `.env` file in the root of the project by copying `.env.example` (if one existed, otherwise create it manually) and fill in the required values.

The necessary environment variables are:

*   `DATABASE_URL`: PostgreSQL connection string.
    *   Example: `postgres://YOUR_DB_USER:YOUR_DB_PASSWORD@YOUR_DB_HOST:5432/YOUR_DB_NAME`
*   `YOUTUBE_API_KEY`: Your YouTube Data API v3 key.
*   `TWITCH_CLIENT_ID`: Your Twitch application client ID.
*   `TWITCH_CLIENT_SECRET`: Your Twitch application client secret.
*   `GOOGLE_CLIENT_ID`: Your Google OAuth client ID.
*   `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret.
*   `SESSION_SECRET`: A random string for session management.

### 5. Database Setup

1.  **Ensure your PostgreSQL server is running.**
2.  **Create the database** if it doesn't exist (the name should match the one in `DATABASE_URL`).
3.  **Initialize the schema:** Execute the `setup_database.sql` script against your database. You can use a tool like `psql` or a GUI client.
    ```bash
    # Example using psql
    psql -U YOUR_DB_USER -d YOUR_DB_NAME -f setup_database.sql
    ```
4.  **Seed and Migrate Database:** This command now performs several actions:
    *   Seeds default users (e.g., "5crore", "dee.2") if they don't already exist.
    *   Ensures the database schema is up-to-date by applying any pending Drizzle migrations.
    *   Clears all existing data from the `games` table.
    *   Populates the `games` table with data from `Games.json`.
    ```bash
    npm run db:seed
    ```
    *Note on Admin User: The default users are created with `isAdmin` set to `false`. If you need to designate an admin user (e.g., for user 'ryoikitokuiten' if it's one of the seeded users, or another user you create), you may need to run an SQL command like `UPDATE users SET "isAdmin" = TRUE WHERE username = 'your_admin_username';` after running the seed script.*

### 6. Running the Application

*   **Development Mode (Client and Server concurrently):**
    ```bash
    npm run dev
    ```
    This will typically start the Vite frontend development server and the Node.js backend server. Check `package.json` for the exact command details.

*   **Building for Production:**
    ```bash
    npm run build
    ```
    This creates a `dist/` folder with the built client and server assets, suitable for deployment (e.g., on Netlify as configured in `netlify.toml`).

## Other Useful Commands

*   **Generate Drizzle Migrations (if you change `shared/schema.ts`):**
    ```bash
    npm run db:generate
    ```
*   **Apply Drizzle Migrations (not typically needed if using `setup_database.sql` for initial setup):**
    ```bash
    npm run db:migrate
    ```
