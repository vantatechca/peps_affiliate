import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ReportOptions {
  title: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string }>;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
}

export function generatePDF(options: ReportOptions) {
  const doc = new jsPDF();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, 14, y);
  y += 8;

  // Subtitle
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(options.subtitle, 14, y);
    doc.setTextColor(0);
    y += 6;
  }

  // Generated date
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, y);
  doc.setTextColor(0);
  y += 12;

  // Stats summary
  if (options.stats && options.stats.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    options.stats.forEach((stat) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${stat.label}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.value, 70, y);
      y += 6;
    });
    y += 6;
  }

  // Tables
  if (options.tables) {
    options.tables.forEach((table) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(table.title, 14, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        head: [table.headers],
        body: table.rows,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [30, 30, 30],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250],
        },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 12;
    });
  }

  return doc;
}

export function downloadAffiliateReport(
  affiliateName: string,
  stats: any,
  orders: any[],
  codes: any[],
) {
  const doc = generatePDF({
    title: 'Affiliate Sales Report',
    subtitle: affiliateName,
    stats: [
      { label: "Today's Earnings", value: formatMoney(stats.daily.earnings) + ` (${stats.daily.orders} orders)` },
      { label: 'This Month', value: formatMoney(stats.monthly.earnings) + ` (${stats.monthly.orders} orders)` },
      { label: 'All Time Earnings', value: formatMoney(stats.total.earnings) + ` (${stats.total.orders} orders)` },
    ],
    tables: [
      {
        title: 'Discount Codes',
        headers: ['Code', 'Label', 'Discount', 'Times Used', 'Expires', 'Status'],
        rows: codes.map((c: any) => [
          c.code,
          c.label || '—',
          `${(c.discountPercent * 100).toFixed(0)}%`,
          c.timesUsed.toString(),
          c.expiresAt ? formatDate(c.expiresAt) : 'Never',
          !c.active ? 'Inactive' : c.expiresAt && new Date(c.expiresAt) < new Date() ? 'Expired' : 'Active',
        ]),
      },
      {
        title: 'Orders',
        headers: ['Date', 'Customer', 'Items', 'Code', 'Order Total', 'Earning'],
        rows: orders.map((o: any) => [
          formatDate(o.date),
          o.customerFirstName,
          o.itemsSummary,
          o.discountCode,
          formatMoney(o.orderTotal),
          formatMoney(o.commissionEarned),
        ]),
      },
    ],
  });

  doc.save(`affiliate-report-${affiliateName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function downloadBusinessOverviewPDF(stats: any, sourceFilter?: string) {
  const source = sourceFilter ? sourceFilter.charAt(0).toUpperCase() + sourceFilter.slice(1) : 'All Sources';

  const doc = generatePDF({
    title: 'Business Overview Report',
    subtitle: `Source: ${source}`,
    stats: [
      { label: 'Total Revenue', value: formatMoney(stats.totalRevenue) + ` (${stats.totalOrders} orders)` },
      { label: "Today's Revenue", value: formatMoney(stats.todayRevenue) + ` (${stats.todayOrders} orders)` },
      { label: 'This Month', value: formatMoney(stats.monthRevenue) + ` (${stats.monthOrders} orders)` },
      { label: 'Net Revenue', value: formatMoney(stats.netRevenue) },
      { label: 'Conversion Rate', value: `${stats.conversionRate.toFixed(1)}%` },
      { label: 'Attributed Orders', value: `${stats.attributedOrders} (${formatMoney(stats.attributedRevenue)})` },
      { label: 'Non-Attributed Orders', value: `${stats.nonAttributedOrders} (${formatMoney(stats.nonAttributedRevenue)})` },
      { label: 'Total Commissions', value: formatMoney(stats.totalCommissions) },
      { label: 'Pending Payouts', value: formatMoney(stats.pendingPayouts) },
      { label: 'Active Affiliates', value: stats.activeAffiliates.toString() },
      { label: 'Active Codes', value: stats.activeCodes.toString() },
    ],
  });

  doc.save(`business-overview-${new Date().toISOString().split('T')[0]}.pdf`);
}

export function downloadAdminReport(
  stats: any,
  affiliates: any[],
  orders: any[],
  affiliateName?: string,
) {
  const isFiltered = !!affiliateName;

  const statsList = isFiltered
    ? [
        { label: 'Affiliate', value: affiliateName! },
        { label: 'Attributed Orders', value: stats.attributedOrders.toString() },
        { label: 'Revenue', value: formatMoney(stats.totalRevenue) },
        { label: 'Commissions', value: formatMoney(stats.totalCommissions) },
        { label: 'Pending Payouts', value: formatMoney(stats.pendingPayouts) },
      ]
    : [
        { label: 'Total Affiliates', value: `${stats.totalAffiliates} (${stats.activeAffiliates} active)` },
        { label: 'Attributed Orders', value: stats.attributedOrders.toString() },
        { label: 'Total Revenue', value: formatMoney(stats.totalRevenue) },
        { label: 'Total Commissions', value: formatMoney(stats.totalCommissions) },
        { label: 'Pending Payouts', value: formatMoney(stats.pendingPayouts) },
      ];

  const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = [];

  if (!isFiltered) {
    tables.push({
      title: 'Affiliates',
      headers: ['Name', 'Email', 'Commission', 'Codes', 'Status'],
      rows: affiliates.map((a: any) => [
        a.name,
        a.email,
        `${(a.defaultCommissionRate * 100).toFixed(0)}%`,
        (a.discountCodes?.length || 0).toString(),
        a.active ? 'Active' : 'Inactive',
      ]),
    });
  }

  tables.push({
    title: isFiltered ? `Orders — ${affiliateName}` : 'Recent Orders',
    headers: ['Date', 'Customer', 'Items', 'Code', 'Affiliate', 'Total', 'Commission'],
    rows: orders.slice(0, 100).map((o: any) => [
      formatDate(o.createdAt),
      o.customerFirstName,
      o.itemsSummary,
      o.discountCode?.code || '—',
      o.discountCode?.affiliate?.name || '—',
      formatMoney(o.orderTotal),
      formatMoney(o.commissionEarned),
    ]),
  });

  const doc = generatePDF({
    title: isFiltered ? `Affiliate Report — ${affiliateName}` : 'Admin Sales Report',
    subtitle: isFiltered ? 'Individual Affiliate Performance' : 'All Affiliates Overview',
    stats: statsList,
    tables,
  });

  const filename = isFiltered
    ? `affiliate-report-${affiliateName!.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
    : `admin-report-${new Date().toISOString().split('T')[0]}.pdf`;

  doc.save(filename);
}
