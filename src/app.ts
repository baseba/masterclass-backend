import morgan from "morgan";
import express from "express";
import passport from "passport";
import bodyParser from "body-parser";
import cors from "cors";
import authRouter from "./routes/auth";
import helloRouter from "./routes/hello";
import adminRouter from "./routes/admin";
import professorRouter from "./routes/professor/professors";
import courseRouter from "./routes/course/courses";
import authenticateJwt from "./middleware/authenticateJwt";
import slotRouter from "./controllers/slots.controller";
import sessionRouter from "./routes/course/sessions";
import reservationRouter from "./controllers/reservations.controller";
import cronjobsController from "./controllers/cronjobs.controller";
import v2UsersRouter from "./routes/v2/users";
import v2StudentRouter from "./routes/v2/student";

const allowedOrigins = ["http://localhost:4321", "https://tu-dominio.com"];


const app = express();
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(morgan("dev"));
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/professors", professorRouter);
app.use("/courses", courseRouter);
app.use("/slots", slotRouter);
app.use("/reservations", reservationRouter);
app.use("/cron", cronjobsController);
app.use("/v2/users", v2UsersRouter);
app.use("/v2", v2StudentRouter);
app.use("/", helloRouter);

app.get("/public", (req, res) => {
  res.json({ message: "Public endpoint" });
});

app.get("/protected", authenticateJwt, (req, res) => {
  // @ts-ignore
  res.json({ message: `Hello ${req.user.email}` });
});

export default app;
