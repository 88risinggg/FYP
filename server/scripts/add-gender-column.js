const { pool } = require("../src/config/db");

async function addGenderColumn() {
  const connection = await pool.getConnection();
  try {
    console.log("Checking if gender column exists in staff table...");
    
    // Check if the column already exists
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'staff' 
       AND COLUMN_NAME = 'gender'`
    );

    if (columns.length > 0) {
      console.log("✓ gender column already exists.");
      return;
    }

    console.log("Adding gender column to staff table...");
    
    // Add the gender column after date_of_birth
    await connection.query(
      `ALTER TABLE staff 
       ADD COLUMN gender VARCHAR(10) NULL 
       AFTER date_of_birth`
    );

    console.log("✓ Successfully added gender column to staff table.");
    console.log("  Column: gender VARCHAR(10) NULL");
    console.log("  Position: after date_of_birth");
    
  } catch (error) {
    console.error("✗ Failed to add gender column:", error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the migration
addGenderColumn()
  .then(() => {
    console.log("\n✓ Migration completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  });
