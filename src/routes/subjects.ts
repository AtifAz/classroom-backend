import { ilike, or, and, sql, eq, getTableColumns, desc } from "drizzle-orm";
import { subjects, departments } from "../db/schema/index.js";
import express from "express";
import { db } from "../db/index.js";
import { count } from "node:console";
import { get } from "node:http";
import { parse } from "node:path";

const router = express.Router();

//Get all subjects with optional search , filtering and pagination
router.get("/", async (req, res) => {
  try {
    //req.query parameters is something like /subjects?search=math&departmentId=2&page=1&limit=10
    const { search, departmentName, page = 1, limit = 10 } = req.query;
    const currentPage = Math.max(1, parseInt(page as string, 10) || 1);
    const limitPerPage = Math.max(
      1,
      Math.min(parseInt(limit as string, 10) || 10, 100),
    );
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
      // Escape special characters % and _ in departmentName for ILIKE pattern
      const deptPattern = `%${String(departmentName).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(departments.name, deptPattern));
    }

    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    // Get total count for pagination in SQL -> Select count(distinct subjects.id) from subjects left join departments on subjects.departmentId = departments.id where (conditions)
    const countResult = await db
      .select({ count: sql<number>`count(distinct ${subjects.id})` })
      .from(subjects)
      .leftJoin(departments, eq(subjects.departmentId, departments.id))
      .where(whereClause)
      .execute();

    const totalCount = countResult[0]?.count || 0;

    // Fetch subjects with pagination in SQL -> Select subjects.*, departments.* from subjects left join departments on subjects.departmentId = departments.id where (conditions) order by subjects.createdAt desc limit ? offset ?
    //Offset here means how many records to skip
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
