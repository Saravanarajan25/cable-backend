const express = require('express');
const ExcelJS = require('exceljs');
const Home = require('../models/Home');
const Payment = require('../models/Payment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/export/excel?month=X&year=Y&status=all|paid|unpaid
router.get('/excel', authMiddleware, async (req, res) => {
    const { month, year, status } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
    }

    try {
        // Get all homes
        const homes = await Home.find().sort({ home_id: 1 }).lean();

        // Get all payments for the specified year
        const allYearPayments = await Payment.find({ year: parseInt(year) }).lean();

        // Business Logic for Month-Based Behavior
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-indexed

        let reportingLimitMonth;
        const selectedYearInt = parseInt(year);
        const selectedMonthInt = parseInt(month);

        if (selectedYearInt < currentYear) {
            reportingLimitMonth = 12; // Show all months for past years
        } else if (selectedYearInt === currentYear) {
            // For the current year, show up to the month selected
            reportingLimitMonth = currentMonth;
        } else {
            reportingLimitMonth = 0; // Future years show nothing
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payments');

        // Define columns
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        const columns = [
            { header: 'S.No', key: 'sno', width: 8 },
            { header: 'Home ID', key: 'home_id', width: 12 },
            { header: 'Customer Name', key: 'customer_name', width: 25 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Set-Top Box ID', key: 'set_top_box_id', width: 18 },
            { header: 'Monthly Amount', key: 'monthly_amount', width: 15 }
        ];

        // Add 12 month columns
        monthNames.forEach((mName, index) => {
            columns.push({ header: mName, key: `month_${index + 1}`, width: 12 });
        });

        worksheet.columns = columns;

        // Filter homes based on status of the selected month
        const filteredHomes = homes.filter(home => {
            if (!status || status === 'all') return true;
            const payment = allYearPayments.find(p => p.home_id === home.home_id && p.month === selectedMonthInt);
            const homeStatus = payment ? payment.status : 'unpaid';
            return homeStatus === status;
        });

        // Add rows for filtered homes
        filteredHomes.forEach((home, index) => {
            const rowData = {
                sno: index + 1,
                home_id: home.home_id,
                customer_name: home.customer_name,
                phone: home.phone,
                set_top_box_id: home.set_top_box_id,
                monthly_amount: home.monthly_amount
            };

            // Populate monthly columns (Jan to Dec)
            for (let m = 1; m <= 12; m++) {
                const payment = allYearPayments.find(p => p.home_id === home.home_id && p.month === m);

                if (payment && payment.status === 'paid') {
                    // Show paid_date if paid, even if it's a future month
                    if (payment.paid_date) {
                        const d = new Date(payment.paid_date);
                        // Format: DD-MM-YYYY
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const year = d.getFullYear();
                        rowData[`month_${m}`] = `${day}-${month}-${year}`;
                    } else {
                        rowData[`month_${m}`] = 'Paid';
                    }
                } else {
                    // Not paid logic
                    if (m > reportingLimitMonth) {
                        rowData[`month_${m}`] = ''; // Future months: Empty
                    } else {
                        rowData[`month_${m}`] = '-'; // Past/Current months: Dash
                    }
                }
            }
            worksheet.addRow(rowData);
        });


        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Align all cells to center
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.alignment = { horizontal: 'center' };
            });
        });

        // Generate filename
        const fullMonthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = fullMonthNames[selectedMonthInt - 1];
        const statusText = status && status !== 'all' ? status.toUpperCase() : 'ALL';
        const filename = `Cable_Payment_Register_${year}_${monthName}_${statusText}.xlsx`;

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

module.exports = router;
