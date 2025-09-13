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

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/professors", professorRouter);
app.use("/courses", courseRouter);
app.use("/slots", slotRouter);
app.use("/", helloRouter);

app.get("/public", (req, res) => {
  res.json({ message: "Public endpoint" });
});

app.get("/protected", authenticateJwt, (req, res) => {
  // @ts-ignore
  res.json({ message: `Hello ${req.user.email}` });
});

export default app;
