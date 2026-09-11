const Repairing = require("../models/repairingModel");
const Worker = require("../models/Worker");
const asyncHandler = require("express-async-handler");
const apiError = require("../utils/apiError");

// Helper function to get days in month (handles leap years)
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Helper function to create date range for a specific day
function createDateRange(year: number, month: number, day?: number) {
  const startDate = new Date(Date.UTC(year, month - 1, day || 1, 0, 0, 0));
  const endDate = day 
    ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
    : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

// Helper function to create previous month range
function createPreviousMonthRange(year: number, month: number) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return createDateRange(prevYear, prevMonth);
}

// Helper function to calculate percentage change
function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// @desc    Get monthly analytics overview
// @route   GET /api/V1/analytics/monthly-overview
// @access  Private (admin, manager)
export const getMonthlyOverview = asyncHandler(async (req, res, next) => {
  // Get the actual collection name from the Worker model
  const workerCollectionName = Worker.collection.name;
  const { month, year, day, from, to } = req.query;
  
  // Check if custom date range is provided
  const useCustomRange = from && to;
  
  let startDate, endDate, prevMonthStart, prevMonthEnd, fullMonthStart, fullMonthEnd, daysInMonth;
  let displayPeriod;

  if (useCustomRange) {
    // Custom date range
    startDate = new Date(from as string);
    endDate = new Date(to as string);
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new apiError("Invalid date format. Use ISO format (e.g., 2026-08-15)", 400));
    }
    
    if (startDate > endDate) {
      return next(new apiError("'from' date must be before 'to' date", 400));
    }

    // Calculate previous period for comparison (same duration, immediately preceding)
    const duration = endDate.getTime() - startDate.getTime();
    prevMonthEnd = new Date(startDate.getTime() - 1);
    prevMonthEnd.setHours(23, 59, 59, 999);
    prevMonthStart = new Date(prevMonthEnd.getTime() - duration);
    
    // For daily trend, create day-by-day breakdown for the custom range
    fullMonthStart = new Date(startDate);
    fullMonthEnd = new Date(endDate);
    daysInMonth = Math.ceil((fullMonthEnd.getTime() - fullMonthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    displayPeriod = {
      customRange: true,
      from: startDate.toISOString(),
      to: endDate.toISOString()
    };
  } else {
    // Original month/year/day logic
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month as string) : currentDate.getUTCMonth() + 1;
    const targetYear = year ? parseInt(year as string) : currentDate.getUTCFullYear();
    const targetDay = day ? parseInt(day as string) : undefined;

    // Validate inputs
    if (targetMonth < 1 || targetMonth > 12) {
      return next(new apiError("Month must be between 1 and 12", 400));
    }
    if (targetYear < 2000 || targetYear > 2100) {
      return next(new apiError("Year must be between 2000 and 2100", 400));
    }
    if (targetDay && (targetDay < 1 || targetDay > 31)) {
      return next(new apiError("Day must be between 1 and 31", 400));
    }

    // Create date ranges
    const dateRange = createDateRange(targetYear, targetMonth, targetDay);
    startDate = dateRange.startDate;
    endDate = dateRange.endDate;
    
    const prevMonthRange = createPreviousMonthRange(targetYear, targetMonth);
    prevMonthStart = prevMonthRange.startDate;
    prevMonthEnd = prevMonthRange.endDate;

    // Create full month range for daily trend (always full month regardless of day filter)
    const fullMonthRange = createDateRange(targetYear, targetMonth);
    fullMonthStart = fullMonthRange.startDate;
    fullMonthEnd = fullMonthRange.endDate;
    daysInMonth = getDaysInMonth(targetYear, targetMonth);
    
    displayPeriod = {
      customRange: false,
      year: targetYear,
      month: targetMonth,
      day: targetDay || null
    };
  }

  // Main aggregation pipeline using $facet for parallel execution
  const analyticsData = await Repairing.aggregate([
    {
      $facet: {
        // KPI Summary
        kpiSummary: [
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalRepairs: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$complete", true] }, { $ne: ["$completedAt", null] }] },
                    { $ifNull: ["$priceAfterDiscount", 0] },
                    0
                  ]
                }
              },
              completedRepairsCount: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$complete", true] }, { $ne: ["$completedAt", null] }] },
                    1,
                    0
                  ]
                }
              },
              currentlyRepairing: {
                $sum: {
                  $cond: [{ $eq: ["$complete", false] }, 1, 0]
                }
              },
              overdueRepairs: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$complete", false] },
                        { $lt: ["$createdAt", { $subtract: ["$$NOW", 5 * 24 * 60 * 60 * 1000] }] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              totalCompletionTime: {
                $sum: {
                  $cond: [
                    { $ne: ["$completedAt", null] },
                    { $divide: [{ $subtract: ["$completedAt", "$createdAt"] }, 3600000] }, // Convert to hours
                    0
                  ]
                }
              },
              completedRepairsWithTime: {
                $sum: {
                  $cond: [{ $ne: ["$completedAt", null] }, 1, 0]
                }
              }
            }
          },
          {
            $project: {
              _id: 0,
              totalRepairs: 1,
              totalRevenue: 1,
              completedRepairsCount: 1,
              currentlyRepairing: 1,
              overdueRepairs: 1,
              averageRepairCost: {
                $cond: [
                  { $gt: ["$completedRepairsCount", 0] },
                  { $divide: ["$totalRevenue", "$completedRepairsCount"] },
                  0
                ]
              },
              averageCompletionTimeHours: {
                $cond: [
                  { $gt: ["$completedRepairsWithTime", 0] },
                  { $divide: ["$totalCompletionTime", "$completedRepairsWithTime"] },
                  0
                ]
              }
            }
          }
        ],

        // Previous month data for comparison
        previousMonthData: [
          {
            $match: {
              createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd }
            }
          },
          {
            $group: {
              _id: null,
              totalRepairs: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$complete", true] }, { $ne: ["$completedAt", null] }] },
                    { $ifNull: ["$priceAfterDiscount", 0] },
                    0
                  ]
                }
              }
            }
          }
        ],

        // Daily Trend (always full month or custom range)
        dailyTrend: [
          {
            $match: {
              createdAt: { $gte: fullMonthStart, $lte: fullMonthEnd }
            }
          },
          {
            $project: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              dayOfMonth: { $dayOfMonth: "$createdAt" },
              repairCount: 1,
              complete: 1,
              completedAt: 1,
              priceAfterDiscount: 1
            }
          },
          {
            $group: {
              _id: "$date",
              dayOfMonth: { $first: "$dayOfMonth" },
              repairCount: { $sum: 1 },
              completedCount: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$complete", true] }, { $ne: ["$completedAt", null] }] },
                    1,
                    0
                  ]
                }
              },
              revenue: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$complete", true] }, { $ne: ["$completedAt", null] }] },
                    { $ifNull: ["$priceAfterDiscount", 0] },
                    0
                  ]
                }
              }
            }
          },
          {
            $sort: { _id: 1 }
          }
        ],

        // Status Breakdown
        statusBreakdown: [
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $project: {
              complete: 1,
              Services: 1
            }
          },
          {
            $addFields: {
              hasInProgressServices: {
                $anyElementTrue: {
                  $map: {
                    input: "$Services",
                    as: "service",
                    in: { $eq: ["$$service.state", "repairing"] }
                  }
                }
              },
              hasStartedServices: {
                $anyElementTrue: {
                  $map: {
                    input: "$Services",
                    as: "service",
                    in: { $ne: ["$$service.state", "repairing"] }
                  }
                }
              }
            }
          },
          {
            $addFields: {
              status: {
                $cond: [
                  { $eq: ["$complete", true] },
                  "completed",
                  {
                    $cond: [
                      "$hasInProgressServices",
                      "inProgress",
                      {
                        $cond: [
                          "$hasStartedServices",
                          "inProgress",
                          "pending"
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 }
            }
          }
        ],

        // Client Distribution
        clientDistribution: [
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $project: {
              carId: 1,
              complete: 1,
              completedAt: 1,
              priceAfterDiscount: 1
            }
          },
          {
            $addFields: {
              clientType: {
                $cond: [
                  { $eq: ["$carId", null] },
                  "walkIn",
                  "registered"
                ]
              }
            }
          },
          {
            $group: {
              _id: "$clientType",
              count: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$complete", true] }, { $ne: ["$completedAt", null] }] },
                    { $ifNull: ["$priceAfterDiscount", 0] },
                    0
                  ]
                }
              }
            }
          }
        ],

        // Worker Productivity
        workerProductivity: [
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate },
              complete: true
            }
          },
          {
            $unwind: {
              path: "$technicians",
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $group: {
              _id: {
                workerId: "$technicians.workerId",
                workerName: "$technicians.name"
              },
              completedRepairs: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              workerId: "$_id.workerId",
              workerName: { $ifNull: ["$_id.workerName", "Unknown Worker"] },
              completedRepairs: 1
            }
          },
          {
            $sort: { completedRepairs: -1 }
          }
        ],

        // Periodic vs Non-Periodic
        periodicVsNonPeriodic: [
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 }
            }
          }
        ],

      }
    }
  ]);

  // Extract data from aggregation result
  const result = analyticsData[0];
  
  // Handle KPI summary and previous month comparison
  const kpiData = result.kpiSummary[0] || {
    totalRepairs: 0,
    totalRevenue: 0,
    currentlyRepairing: 0,
    overdueRepairs: 0,
    averageRepairCost: 0,
    averageCompletionTimeHours: 0
  };

  const prevMonthData = result.previousMonthData[0] || {
    totalRepairs: 0,
    totalRevenue: 0
  };

  // Calculate percentage changes
  const repairsChange = calculatePercentageChange(kpiData.totalRepairs, prevMonthData.totalRepairs);
  const revenueChange = calculatePercentageChange(kpiData.totalRevenue, prevMonthData.totalRevenue);
  
  // For custom ranges, adjust the comparison label
  const comparisonLabel = useCustomRange ? "vsPreviousPeriod" : "vsLastMonth";

  // Build complete daily trend array (fill missing days with 0)
  const dailyTrendMap = new Map();
  result.dailyTrend.forEach(item => {
    if (useCustomRange) {
      dailyTrendMap.set(item._id, {
        day: item.dayOfMonth,
        date: item._id,
        repairCount: item.repairCount,
        completedCount: item.completedCount,
        revenue: item.revenue
      });
    } else {
      dailyTrendMap.set(item.dayOfMonth, {
        day: item.dayOfMonth,
        repairCount: item.repairCount,
        completedCount: item.completedCount,
        revenue: item.revenue
      });
    }
  });

  const completeDailyTrend = [];
  
  if (useCustomRange) {
    // For custom ranges, create date-by-day entries
    const currentDate = new Date(fullMonthStart);
    let dayCounter = 1;
    while (currentDate <= fullMonthEnd) {
      const dayKey = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (dailyTrendMap.has(dayKey)) {
        completeDailyTrend.push({
          ...dailyTrendMap.get(dayKey),
          day: dayCounter
        });
      } else {
        completeDailyTrend.push({
          day: dayCounter,
          date: dayKey,
          repairCount: 0,
          completedCount: 0,
          revenue: 0
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
      dayCounter++;
    }
  } else {
    // Original month-based logic - use day numbers (1-31)
    for (let i = 1; i <= daysInMonth; i++) {
      if (dailyTrendMap.has(i)) {
        completeDailyTrend.push(dailyTrendMap.get(i));
      } else {
        completeDailyTrend.push({
          day: i,
          repairCount: 0,
          completedCount: 0,
          revenue: 0
        });
      }
    }
  }

  // Process status breakdown with percentages
  const totalStatusCount = result.statusBreakdown.reduce((sum, item) => sum + item.count, 0);
  const statusBreakdown = result.statusBreakdown.map(item => ({
    status: item._id,
    count: item.count,
    percentage: totalStatusCount > 0 ? ((item.count / totalStatusCount) * 100).toFixed(1) : 0
  }));

  // Process client distribution
  const clientDistributionMap = new Map();
  result.clientDistribution.forEach(item => {
    clientDistributionMap.set(item._id, {
      type: item._id,
      count: item.count,
      revenue: item.revenue
    });
  });

  const clientDistribution = {
    walkInCount: clientDistributionMap.get("walkIn")?.count || 0,
    registeredCount: clientDistributionMap.get("registered")?.count || 0,
    walkInRevenue: clientDistributionMap.get("walkIn")?.revenue || 0,
    registeredRevenue: clientDistributionMap.get("registered")?.revenue || 0
  };

  // Process periodic vs non-periodic
  const periodicVsNonPeriodicMap = new Map();
  result.periodicVsNonPeriodic.forEach(item => {
    periodicVsNonPeriodicMap.set(item._id, item.count);
  });

  const periodicVsNonPeriodic = [
    { type: "periodic", count: periodicVsNonPeriodicMap.get("periodic") || 0 },
    { type: "nonPeriodic", count: periodicVsNonPeriodicMap.get("nonPeriodic") || 0 }
  ];


  // Final response
  const response = {
    period: {
      ...displayPeriod,
      range: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      }
    },
    kpiSummary: {
      totalRepairs: kpiData.totalRepairs,
      totalRevenue: kpiData.totalRevenue,
      [comparisonLabel]: {
        repairsChange: repairsChange.toFixed(1),
        revenueChange: revenueChange.toFixed(1)
      },
      currentlyRepairing: kpiData.currentlyRepairing,
      averageRepairCost: kpiData.averageRepairCost,
      averageCompletionTimeHours: kpiData.averageCompletionTimeHours.toFixed(2),
      overdueRepairs: kpiData.overdueRepairs
    },
    charts: {
      dailyTrend: completeDailyTrend,
      statusBreakdown,
      clientDistribution,
      workerProductivity: result.workerProductivity,
      periodicVsNonPeriodic
    }
  };

  res.status(200).json({ data: response });
});