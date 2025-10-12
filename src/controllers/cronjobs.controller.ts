import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prismaSlot = new PrismaClient().slot;
const router = Router();

// CREATE
router.post("/daily-job", async (req, res) => {
  if (req.query.key !== process.env.CRON_KEY) {
    return res.status(403).send("Forbidden");
  }
  // logica del cron job
  res.send("Job ran!");
});

