import { ilike, or, and, sql, eq, getTableColumns, desc } from "drizzle-orm";
import { subjects, departments } from "../db/schema/index.js";
import express from "express";
import { db } from "../db/index.js";
import { count } from "node:console";
import { get } from "node:http";

const router = express.Router();

//Get all subjects with optional search , filtering and pagination
router.get("/", async (req, res) => {
  try {
    //req.query parameters is something like /subjects?search=math&departmentId=2&page=1&limit=10
    const { search, departmentName, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, +page);
    const limitPerPage = Math.max(1, +limit);
    // How many records to skip to next page
    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];
    if (search) {
      filterConditions.push(
        or(
          ilike(subjects.name, `%${search}%`),
          ilike(subjects.code, `%${search}%`),
        ),
      );
    }
    if (departmentName) {
      filterConditions.push(ilike(departments.name, `%${departmentName}%`));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(distinct ${subjects.id})` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .execute();

    const totalCount = countResult[0]?.count || 0;

    const subjectList = await db
      .select({
        ...getTableColumns(subjects),
        department: {
          ...getTableColumns(departments),
        },
      })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .orderBy(desc(subjects.createdAt))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: subjectList,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      },
    });
  } catch (error) {
    console.error(`GET /subjects error: ${error}`);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
