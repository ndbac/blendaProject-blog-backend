const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const dbConnect = require("./config/db/dbConnect");
const userRoutes = require("./route/users/usersRoute");
const { errorHandler, notFound } = require("./middlewares/error/errorHandler");

const app = express();
//BD
dbConnect();

//Middleware
app.use(express.json());

//Users route
app.use('/api/users', userRoutes);


//Err handler
app.use(notFound);
app.use(errorHandler);
//Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}`);
});
