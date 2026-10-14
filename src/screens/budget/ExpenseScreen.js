import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Image,
  Linking,
  AppState,
  ActivityIndicator,
  Share
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainHeader, BottomNav, CalendarPickerModal } from '../../components';
import api, { resolveFileUrl } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadAndShareRemoteFile } from '../../utils/fileExport';

const formatINR = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
};

const formatExpenseDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

const DEFAULT_CATEGORIES = [
  'Infrastructure Repair',
  'Water Purifiers',
  'Roads & Transport',
  'Drainage',
  'Civic Works',
  'Utilities',
  'Office Stationery',
  'Catering',
  'Travel',
  'Maintenance',
  'Staff Welfare',
  'Miscellaneous'
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

// Color palette for the segmented share bar
const SHARE_COLORS = [
  '#0d9488', // Teal
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#64748b'  // Slate
];

// Category pill badges style resolver matching reference UI
const getCategoryBadgeStyle = (categoryName) => {
  const name = (categoryName || '').toLowerCase();
  if (name.includes('infra') || name.includes('drainage') || name.includes('civic')) {
    return { bg: '#ccfbf1', text: '#0f766e' };
  }
  if (name.includes('water') || name.includes('purifier')) {
    return { bg: '#e0f2fe', text: '#0284c7' };
  }
  if (name.includes('road') || name.includes('transport') || name.includes('travel')) {
    return { bg: '#fef3c7', text: '#d97706' };
  }
  if (name.includes('utilit') || name.includes('electr')) {
    return { bg: '#ede9fe', text: '#7c3aed' };
  }
  if (name.includes('staff') || name.includes('welfare') || name.includes('catering')) {
    return { bg: '#ffe4e6', text: '#e11d48' };
  }
  if (name.includes('stationery') || name.includes('office')) {
    return { bg: '#e0e7ff', text: '#4338ca' };
  }
  return { bg: '#f1f5f9', text: '#475569' };
};

export default function ExpenseScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddExpensePress,
  onOpenDrawer,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 0
}) {
  const insets = useSafeAreaInsets();
  const [internalTab, setInternalTab] = useState(activeTab);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [expensesList, setExpensesList] = useState([]);
  const [budgetsList, setBudgetsList] = useState([]);
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    averageAmount: 0,
    categoryBreakdown: []
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [calendarPickerTarget, setCalendarPickerTarget] = useState(null); // 'filter_start' | 'filter_end' | 'edit_date' | null

  // Pagination & Limit States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  // Reset to page 1 whenever filters or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, startDateFilter, endDateFilter, itemsPerPage]);

  // Date Presets Handler
  const applyDatePreset = (presetKey) => {
    const today = new Date();
    const formatYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (presetKey === 'today') {
      const ymd = formatYMD(today);
      setStartDateFilter(ymd);
      setEndDateFilter(ymd);
    } else if (presetKey === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDateFilter(formatYMD(start));
      setEndDateFilter(formatYMD(end));
    } else if (presetKey === 'last_30') {
      const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDateFilter(formatYMD(start));
      setEndDateFilter(formatYMD(today));
    } else if (presetKey === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      setStartDateFilter(formatYMD(start));
      setEndDateFilter(formatYMD(end));
    } else if (presetKey === 'clear') {
      setStartDateFilter('');
      setEndDateFilter('');
    }
  };

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState(null);

  // Edit Expense State & Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editBudgetId, setEditBudgetId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Data Fetching
  const fetchExpenses = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [expensesRes, statsRes, catsRes, budgetsRes] = await Promise.allSettled([
        api.get('/expenses'),
        api.get('/expenses/stats'),
        api.get('/expenses/categories'),
        api.get('/budgets')
      ]);

      if (expensesRes.status === 'fulfilled' && expensesRes.value) {
        const raw = expensesRes.value;
        const list = Array.isArray(raw) ? raw : (raw.expenses || []);
        setExpensesList(list);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats({
          totalAmount: statsRes.value.totalMonthlyExpenses || statsRes.value.totalYearlyExpenses || statsRes.value.totalAmount || 0,
          totalCount: statsRes.value.totalExpensesCount || statsRes.value.totalCount || 0,
          averageAmount: statsRes.value.averageAmount || 0,
          categoryBreakdown: statsRes.value.categoryBreakdown || []
        });
      }

      if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value) && catsRes.value.length > 0) {
        const catNames = catsRes.value.map((c) => c.name || c);
        setCategories(catNames);
      }

      if (budgetsRes.status === 'fulfilled' && budgetsRes.value) {
        const rawBudgets = budgetsRes.value;
        setBudgetsList(Array.isArray(rawBudgets) ? rawBudgets : (rawBudgets.budgets || []));
      }
    } catch (err) {
      console.log('Expenses fetch error:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses(false);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchExpenses(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchExpenses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  // Delete Action
  const handleDeleteExpense = (exp) => {
    Alert.alert(
      'Delete Expenditure',
      `Are you sure you want to delete expenditure of ${formatINR(exp.amount)} for "${exp.category}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/expenses/${exp.id}`);
              Alert.alert('Deleted', 'Expense record removed successfully.');
              fetchExpenses();
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete expense.');
            }
          }
        }
      ]
    );
  };

  // Open Edit Modal
  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setEditAmount(String(exp.amount || ''));
    setEditCategory(exp.category || (categories[0] || 'Infrastructure Repair'));
    setEditDescription(exp.description || '');
    setEditDate(exp.expenseDate ? new Date(exp.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditBudgetId(exp.budgetId ? String(exp.budgetId) : '');
    setIsEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editAmount || isNaN(parseFloat(editAmount)) || parseFloat(editAmount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid expense amount.');
      return;
    }
    if (!editDescription.trim()) {
      Alert.alert('Validation Error', 'Please enter a description for the expense.');
      return;
    }

    try {
      setIsSavingEdit(true);
      await api.put(`/expenses/${editingExpense.id}`, {
        amount: parseFloat(editAmount),
        category: editCategory,
        description: editDescription.trim(),
        expenseDate: editDate,
        budgetId: editBudgetId ? parseInt(editBudgetId) : null
      });

      Alert.alert('Success', 'Expense updated successfully.');
      setIsEditModalOpen(false);
      setEditingExpense(null);
      fetchExpenses();
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Unable to update expense.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Invoice Preview
  const handleOpenInvoice = (invoiceUrl, description) => {
    if (!invoiceUrl) return;
    const fullUrl = resolveFileUrl(invoiceUrl);
    const isImage = !!(invoiceUrl.match(/\.(jpg|jpeg|png|webp)$/i));
    setPreviewVoucher({ url: fullUrl, title: description || 'Invoice Receipt', isImage });
    setPreviewModalVisible(true);
  };

  // Filtered Expense list
  const filteredExpenses = useMemo(() => {
    return expensesList.filter((e) => {
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDesc = (e.description || '').toLowerCase().includes(q);
        const matchCat = (e.category || '').toLowerCase().includes(q);
        const matchAmount = String(e.amount || '').includes(q);
        if (!matchDesc && !matchCat && !matchAmount) return false;
      }

      if (startDateFilter) {
        const itemDate = new Date(e.expenseDate);
        const start = new Date(startDateFilter);
        if (itemDate < start) return false;
      }

      if (endDateFilter) {
        const itemDate = new Date(e.expenseDate);
        const end = new Date(endDateFilter + 'T23:59:59');
        if (itemDate > end) return false;
      }

      return true;
    });
  }, [expensesList, selectedCategory, searchQuery, startDateFilter, endDateFilter]);

  // Total Pages based on filtered results
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredExpenses.length / itemsPerPage));
  }, [filteredExpenses.length, itemsPerPage]);

  // Paginated Expense items for the current page view
  const paginatedExpenses = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  // Smart page numbers array with ellipsis for compact rendering
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [totalPages, currentPage]);

  const showingStart = filteredExpenses.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingEnd = Math.min(currentPage * itemsPerPage, filteredExpenses.length);

  // Compute Grand Total, Pending Total & Category Wise Share (Strictly Live Data)
  const { calculatedTotal, pendingTotal, categoryShares } = useMemo(() => {
    const total = expensesList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pending = expensesList
      .filter((e) => (e.status || '').toUpperCase() === 'PENDING')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    if (total === 0 || expensesList.length === 0) {
      return {
        calculatedTotal: 0,
        pendingTotal: 0,
        categoryShares: []
      };
    }

    const catMap = {};
    expensesList.forEach((e) => {
      const cat = e.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const sorted = Object.keys(catMap)
      .map((cat) => ({ name: cat, amount: catMap[cat] }))
      .sort((a, b) => b.amount - a.amount);

    let shares = [];
    if (sorted.length <= 4) {
      shares = sorted.map((item, idx) => ({
        name: item.name,
        percentage: Math.round((item.amount / total) * 100),
        color: SHARE_COLORS[idx % SHARE_COLORS.length]
      }));
    } else {
      const top3 = sorted.slice(0, 3);
      const others = sorted.slice(3);
      const otherTotal = others.reduce((sum, item) => sum + item.amount, 0);

      shares = top3.map((item, idx) => ({
        name: item.name,
        percentage: Math.round((item.amount / total) * 100),
        color: SHARE_COLORS[idx % SHARE_COLORS.length]
      }));

      shares.push({
        name: 'Other',
        percentage: Math.round((otherTotal / total) * 100),
        color: SHARE_COLORS[3]
      });
    }

    return {
      calculatedTotal: total,
      pendingTotal: pending,
      categoryShares: shares
    };
  }, [expensesList]);

  // Export to Excel / CSV
  const handleExportExcel = async () => {
    if (isExporting) return;
    if (!filteredExpenses || filteredExpenses.length === 0) {
      Alert.alert('No Records', 'There are no expense records matching your current filter to export.');
      return;
    }
    setIsExporting(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Office_Expenses_${dateStr}.csv`;

      const headers = 'ID,Amount (INR),Category,Description,Expense Date,Invoice Available\n';
      const rows = filteredExpenses.map(e => {
        const amt = Number(e.amount) || 0;
        const cat = (e.category || 'General').replace(/"/g, '""');
        const desc = (e.description || '—').replace(/"/g, '""');
        const date = formatExpenseDate(e.expenseDate);
        const hasInv = e.invoiceUrl ? 'Yes' : 'No';
        return `"${e.id}","${amt}","${cat}","${desc}","${date}","${hasInv}"`;
      }).join('\n');

      const csvContent = headers + rows;
      await exportCSVFile(filename, csvContent);
    } catch (err) {
      console.error('Export Excel error:', err);
      Alert.alert('Export Error', err.message || 'Could not export Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    if (isExporting) return;
    if (!filteredExpenses || filteredExpenses.length === 0) {
      Alert.alert('No Records', 'There are no expense records matching your current filter to export.');
      return;
    }
    setIsExporting(true);
    try {
      const totalAmount = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Office_Expenses_Report_${dateStr}.pdf`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Office Expense Statement</title>
            <style>
              @page { size: A4 landscape; margin: 10mm 8mm; }
              * { box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 12px; color: #1e293b; background: #ffffff; }
              .header { border-bottom: 2px solid #0d9488; padding-bottom: 8px; margin-bottom: 12px; }
              h1 { color: #0f766e; font-size: 18px; margin: 0 0 4px 0; }
              .meta { font-size: 10px; color: #64748b; margin-bottom: 10px; }
              .summary-box { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; }
              .stat-title { font-size: 9.5px; color: #0f766e; font-weight: bold; text-transform: uppercase; }
              .stat-val { font-size: 16px; font-weight: bold; color: #115e59; margin-top: 2px; }
              table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; table-layout: fixed; }
              th { background: #f8fafc; color: #334155; padding: 7px 6px; text-align: left; font-weight: 700; border: 1px solid #cbd5e1; word-break: break-word; overflow-wrap: break-word; }
              td { padding: 6px 6px; border: 1px solid #e2e8f0; text-align: left; word-break: break-word; overflow-wrap: break-word; vertical-align: middle; }
              tr:nth-child(even) { background: #fafafa; }
              .footer { margin-top: 20px; font-size: 9.5px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🏛️ Office of Kunal Tilak — Office Expense Statement</h1>
              <div class="meta">
                <strong>Generated on:</strong> ${now.toLocaleString()} | <strong>Filter Category:</strong> ${selectedCategory === 'ALL' ? 'All Categories' : selectedCategory} | <strong>Total Records:</strong> ${filteredExpenses.length}
              </div>
            </div>

            <div class="summary-box">
              <div>
                <div class="stat-title">Total Expenditure</div>
                <div class="stat-val">${formatINR(totalAmount)}</div>
              </div>
              <div>
                <div class="stat-title">Transactions Count</div>
                <div class="stat-val">${filteredExpenses.length} Records</div>
              </div>
              <div>
                <div class="stat-title">Average per Transaction</div>
                <div class="stat-val">${formatINR(filteredExpenses.length > 0 ? Math.round(totalAmount / filteredExpenses.length) : 0)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%;">ID</th>
                  <th style="width: 20%;">Category</th>
                  <th style="width: 44%;">Description</th>
                  <th style="width: 14%; text-align: right;">Amount (₹)</th>
                  <th style="width: 14%; text-align: center;">Expense Date</th>
                </tr>
              </thead>
              <tbody>
                ${filteredExpenses.map(e => `
                  <tr>
                    <td>#${e.id}</td>
                    <td><strong>${e.category || 'General'}</strong></td>
                    <td>${e.description || '—'}</td>
                    <td style="text-align: right; font-weight: bold; color: #0f766e;">₹${(Number(e.amount) || 0).toLocaleString('en-IN')}</td>
                    <td style="text-align: center;">${formatExpenseDate(e.expenseDate)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">लोकप्रतिनिधी कार्यालय / Office of Kunal Tilak — Official Expense Statement</div>
          </body>
        </html>
      `;

      await exportPDFFile(filename, htmlContent);
    } catch (err) {
      console.error('Export PDF error:', err);
      Alert.alert('Export Error', err.message || 'Could not export PDF.');
    } finally {
      setIsExporting(false);
    }
  };


  const allDistinctCategories = useMemo(() => {
    const set = new Set([...categories, ...expensesList.map(e => e.category).filter(Boolean)]);
    return Array.from(set);
  }, [categories, expensesList]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* 1. Portal Header */}
      <MainHeader
        title="Office of Kunal Tilak"
        subtitle="Government Portal"
        unreadCount={unreadCount}
        onNotificationPress={onOpenNotifications}
        onAvatarPress={onOpenProfile}
        onMenuPress={onOpenDrawer}
      />

      {/* 2. Scrollable Body */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />
        }
      >
        {/* Screen Title */}
        <View style={styles.titleSection}>
          <Text style={styles.screenHeading}>Office Expense</Text>
        </View>

        {/* 3. Top Stat Cards (Side-by-Side) */}
        <View style={styles.statsRow}>
          {/* Total Expenses Card */}
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Total Expenses</Text>
            <Text style={styles.statCardAmount} adjustsFontSizeToFit numberOfLines={1}>
              {formatINR(calculatedTotal)}
            </Text>
          </View>

          {/* Pending Amount Card */}
          <View style={styles.statCard}>
            <Text style={styles.statCardLabel}>Pending Amount</Text>
            <Text style={styles.statCardAmount} adjustsFontSizeToFit numberOfLines={1}>
              {formatINR(pendingTotal)}
            </Text>
          </View>
        </View>

        {/* 4. Category Wise Share Card */}
        <View style={styles.shareCard}>
          <Text style={styles.shareCardTitle}>Category Wise Share</Text>

          {categoryShares.length === 0 ? (
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <View style={[styles.segmentedBar, { backgroundColor: '#e2e8f0', marginBottom: 8 }]} />
              <Text style={{ fontSize: 12, color: '#94a3b8', fontWeight: '500' }}>
                No expense category shares recorded (₹0)
              </Text>
            </View>
          ) : (
            <>
              {/* Segmented Progress Bar */}
              <View style={styles.segmentedBar}>
                {categoryShares.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.segmentItem,
                      {
                        flex: Math.max(item.percentage, 1),
                        backgroundColor: item.color
                      }
                    ]}
                  />
                ))}
              </View>

              {/* Legend Row */}
              <View style={styles.legendRow}>
                {categoryShares.map((item, idx) => (
                  <View key={idx} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText} numberOfLines={1}>
                      {item.name} ({item.percentage}%)
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* 5. Filter & Search Controls */}
        <View style={styles.filterSection}>
          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by description..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category Dropdown, Date Range & Limit Row */}
          <View style={styles.dropdownRow}>
            {/* Category Dropdown Pill */}
            <TouchableOpacity
              style={styles.dropdownPill}
              activeOpacity={0.7}
              onPress={() => setIsCategoryModalOpen(true)}
            >
              <Text style={styles.dropdownPillText} numberOfLines={1}>
                {selectedCategory === 'ALL' ? 'All Categories' : selectedCategory}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#475569" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Date Range Pill */}
            <TouchableOpacity
              style={[styles.dropdownPill, (startDateFilter || endDateFilter) && styles.dropdownPillActive]}
              activeOpacity={0.7}
              onPress={() => setIsDateRangeModalOpen(true)}
            >
              <Text style={[styles.dropdownPillText, (startDateFilter || endDateFilter) && styles.dropdownPillTextActive]} numberOfLines={1}>
                {startDateFilter || endDateFilter ? 'Filtered Date' : 'Date Range'}
              </Text>
              <Ionicons name="calendar-outline" size={16} color={startDateFilter || endDateFilter ? '#0d9488' : '#475569'} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Limit / Page Size Pill */}
            <TouchableOpacity
              style={[styles.limitPill, itemsPerPage !== 10 && styles.dropdownPillActive]}
              activeOpacity={0.7}
              onPress={() => setIsLimitModalOpen(true)}
            >
              <Ionicons name="options-outline" size={14} color={itemsPerPage !== 10 ? '#0d9488' : '#475569'} style={{ marginRight: 4 }} />
              <Text style={[styles.dropdownPillText, itemsPerPage !== 10 && styles.dropdownPillTextActive]}>
                {itemsPerPage} / pg
              </Text>
              <Ionicons name="chevron-down" size={14} color={itemsPerPage !== 10 ? '#0d9488' : '#475569'} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>

          {/* Export Buttons Row */}
          <View style={styles.exportRow}>
            {/* Export Excel Button */}
            <TouchableOpacity
              style={[styles.exportExcelBtn, isExporting && { opacity: 0.6 }]}
              activeOpacity={0.8}
              disabled={isExporting}
              onPress={handleExportExcel}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#059669" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="document-text-outline" size={17} color="#059669" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.exportExcelText}>Export Excel</Text>
            </TouchableOpacity>

            {/* Export PDF Button */}
            <TouchableOpacity
              style={[styles.exportPdfBtn, isExporting && { opacity: 0.6 }]}
              activeOpacity={0.8}
              disabled={isExporting}
              onPress={handleExportPDF}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#ef4444" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="document-text-outline" size={17} color="#ef4444" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.exportPdfText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Recent Expenditures Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithCount}>
            <Text style={styles.sectionHeading}>Recent Expenditures</Text>
            {filteredExpenses.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredExpenses.length}</Text>
              </View>
            )}
          </View>
          {loading && <ActivityIndicator size="small" color="#0d9488" />}
        </View>

        {/* 7. Expense Cards List */}
        <View style={styles.expenseCardsContainer}>
          {paginatedExpenses.map((exp) => {
            const badgeStyle = getCategoryBadgeStyle(exp.category);
            const dateFormatted = formatExpenseDate(exp.expenseDate);

            return (
              <View key={exp.id} style={styles.expenseCard}>
                {/* Top Row: Amount & Category Badge */}
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardAmountText} numberOfLines={1}>{formatINR(exp.amount)}</Text>
                  <View style={[styles.categoryBadge, { backgroundColor: badgeStyle.bg }]}>
                    <Text style={[styles.categoryBadgeText, { color: badgeStyle.text }]} numberOfLines={1}>
                      {exp.category || 'General'}
                    </Text>
                  </View>
                </View>

                {/* Middle: Description */}
                <Text style={styles.cardDescription}>{exp.description || 'No description provided.'}</Text>

                {/* Optional linked budget tag */}
                {exp.budget && (
                  <View style={styles.linkedBudgetTag}>
                    <Ionicons name="link-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.linkedBudgetText} numberOfLines={1}>
                      Linked: {exp.budget.allocatedTo || exp.budget.budgetName}
                    </Text>
                  </View>
                )}

                {/* Divider Line */}
                <View style={styles.cardDivider} />

                {/* Bottom Row: Date on Left, Actions on Right */}
                <View style={styles.cardBottomRow}>
                  <Text style={styles.cardDateText}>{dateFormatted}</Text>

                  <View style={styles.cardActionsGroup}>
                    {/* Invoice View Button (if available) */}
                    {exp.invoiceUrl ? (
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.7}
                        onPress={() => handleOpenInvoice(exp.invoiceUrl, exp.description)}
                      >
                        <Ionicons name="document-attach-outline" size={16} color="#0d9488" />
                      </TouchableOpacity>
                    ) : null}

                    {/* Edit Button */}
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      activeOpacity={0.7}
                      onPress={() => handleOpenEdit(exp)}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#475569" />
                    </TouchableOpacity>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.deleteActionBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteExpense(exp)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredExpenses.length === 0 && !loading && (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="receipt-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>No expenditures found</Text>
              <Text style={styles.emptyStateSub}>
                {searchQuery || selectedCategory !== 'ALL' || startDateFilter
                  ? 'No matching expenses for the selected filter.'
                  : 'Tap the teal "+" button to record a new office expenditure.'}
              </Text>
            </View>
          )}
        </View>

        {/* 8. Professional Pagination Controls */}
        {filteredExpenses.length > 0 && (
          <View style={styles.paginationContainer}>
            {/* Info Summary & Quick Limit Selector */}
            <View style={styles.paginationHeader}>
              <Text style={styles.paginationCountText}>
                Showing <Text style={styles.paginationCountBold}>{showingStart}</Text> - <Text style={styles.paginationCountBold}>{showingEnd}</Text> of <Text style={styles.paginationCountBold}>{filteredExpenses.length}</Text> entries
              </Text>
              <TouchableOpacity
                style={styles.limitSelectorChip}
                activeOpacity={0.7}
                onPress={() => setIsLimitModalOpen(true)}
              >
                <Ionicons name="layers-outline" size={13} color="#0d9488" style={{ marginRight: 4 }} />
                <Text style={styles.limitSelectorChipText}>{itemsPerPage} per page</Text>
                <Ionicons name="chevron-down" size={12} color="#0d9488" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>

            {/* Pagination Navigation Buttons */}
            {totalPages > 1 && (
              <View style={styles.paginationNavRow}>
                {/* Prev Button */}
                <TouchableOpacity
                  style={[styles.pageNavButton, currentPage <= 1 && styles.pageNavButtonDisabled]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={15} color={currentPage <= 1 ? '#94a3b8' : '#0f172a'} />
                  <Text style={[styles.pageNavButtonText, currentPage <= 1 && styles.pageNavButtonTextDisabled]}>
                    Prev
                  </Text>
                </TouchableOpacity>

                {/* Page Number Buttons */}
                <View style={styles.pageNumbersList}>
                  {pageNumbers.map((pageItem, index) => {
                    if (pageItem === '...') {
                      return (
                        <View key={`ellipsis-${index}`} style={styles.pageEllipsisWrap}>
                          <Text style={styles.pageEllipsisText}>•••</Text>
                        </View>
                      );
                    }
                    const isActive = currentPage === pageItem;
                    return (
                      <TouchableOpacity
                        key={pageItem}
                        style={[styles.pageNumberPill, isActive && styles.pageNumberPillActive]}
                        onPress={() => setCurrentPage(pageItem)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pageNumberPillText, isActive && styles.pageNumberPillTextActive]}>
                          {pageItem}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Next Button */}
                <TouchableOpacity
                  style={[styles.pageNavButton, currentPage >= totalPages && styles.pageNavButtonDisabled]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageNavButtonText, currentPage >= totalPages && styles.pageNavButtonTextDisabled]}>
                    Next
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={currentPage >= totalPages ? '#94a3b8' : '#0f172a'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* 8. Floating Action Button (FAB) positioned above BottomNav */}
      <TouchableOpacity
        style={[
          styles.fabButton,
          {
            bottom: Math.max(90, insets.bottom + 72)
          }
        ]}
        activeOpacity={0.85}
        onPress={onAddExpensePress}
      >
        <Ionicons name="add" size={32} color="#ffffff" />
      </TouchableOpacity>

      {/* 9. Category Selection Modal */}
      <Modal
        visible={isCategoryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setIsCategoryModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <TouchableOpacity
                style={[
                  styles.categorySelectItem,
                  selectedCategory === 'ALL' && styles.categorySelectItemActive
                ]}
                onPress={() => {
                  setSelectedCategory('ALL');
                  setIsCategoryModalOpen(false);
                }}
              >
                <Text style={[styles.categorySelectText, selectedCategory === 'ALL' && styles.categorySelectTextActive]}>
                  All Categories
                </Text>
                {selectedCategory === 'ALL' && <Ionicons name="checkmark" size={18} color="#0d9488" />}
              </TouchableOpacity>

              {allDistinctCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categorySelectItem,
                    selectedCategory === cat && styles.categorySelectItemActive
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setIsCategoryModalOpen(false);
                  }}
                >
                  <Text style={[styles.categorySelectText, selectedCategory === cat && styles.categorySelectTextActive]}>
                    {cat}
                  </Text>
                  {selectedCategory === cat && <Ionicons name="checkmark" size={18} color="#0d9488" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 10. Date Range Filter Modal */}
      <Modal
        visible={isDateRangeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDateRangeModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date Range</Text>
              <TouchableOpacity onPress={() => setIsDateRangeModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <Text style={styles.inputLabel}>Quick Presets</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity style={styles.presetChip} activeOpacity={0.7} onPress={() => applyDatePreset('today')}>
                <Text style={styles.presetChipText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} activeOpacity={0.7} onPress={() => applyDatePreset('this_month')}>
                <Text style={styles.presetChipText}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} activeOpacity={0.7} onPress={() => applyDatePreset('last_30')}>
                <Text style={styles.presetChipText}>Last 30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} activeOpacity={0.7} onPress={() => applyDatePreset('this_year')}>
                <Text style={styles.presetChipText}>This Year</Text>
              </TouchableOpacity>
            </View>

            {/* Start Date Picker Button */}
            <View style={styles.dateInputGroup}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.datePickerBox}
                activeOpacity={0.7}
                onPress={() => setCalendarPickerTarget('filter_start')}
              >
                <Text style={startDateFilter ? styles.datePickerText : styles.datePlaceholderText}>
                  {startDateFilter ? `${formatExpenseDate(startDateFilter)} (${startDateFilter})` : 'Choose Start Date (Calendar)'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#0d9488" />
              </TouchableOpacity>
            </View>

            {/* End Date Picker Button */}
            <View style={styles.dateInputGroup}>
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.datePickerBox}
                activeOpacity={0.7}
                onPress={() => setCalendarPickerTarget('filter_end')}
              >
                <Text style={endDateFilter ? styles.datePickerText : styles.datePlaceholderText}>
                  {endDateFilter ? `${formatExpenseDate(endDateFilter)} (${endDateFilter})` : 'Choose End Date (Calendar)'}
                </Text>
                <Ionicons name="calendar-outline" size={18} color="#0d9488" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setIsDateRangeModalOpen(false);
                }}
              >
                <Text style={styles.modalSecondaryBtnText}>Clear Filter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => setIsDateRangeModalOpen(false)}
              >
                <Text style={styles.modalPrimaryBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. Edit Expense Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Expenditure</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Amount (₹) *</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor="#94a3b8"
                  value={editAmount}
                  onChangeText={setEditAmount}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {allDistinctCategories.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.categoryChip, editCategory === c && styles.categoryChipActive]}
                      onPress={() => setEditCategory(c)}
                    >
                      <Text style={[styles.categoryChipText, editCategory === c && styles.categoryChipTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  multiline
                  numberOfLines={3}
                  placeholder="Purchase details or reason for expenditure"
                  placeholderTextColor="#94a3b8"
                  value={editDescription}
                  onChangeText={setEditDescription}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Expense Date *</Text>
                <TouchableOpacity
                  style={styles.datePickerBox}
                  activeOpacity={0.7}
                  onPress={() => setCalendarPickerTarget('edit_date')}
                >
                  <Text style={editDate ? styles.datePickerText : styles.datePlaceholderText}>
                    {editDate ? `${formatExpenseDate(editDate)} (${editDate})` : 'Choose Expense Date (Calendar)'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#0d9488" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, isSavingEdit && { opacity: 0.7 }]}
                  disabled={isSavingEdit}
                  onPress={handleSaveEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 12. Fullscreen Invoice Preview Modal */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={styles.fullscreenCloseBtn}
            onPress={() => setPreviewModalVisible(false)}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
            <Text style={styles.fullscreenCloseText}>Close</Text>
          </TouchableOpacity>

          {previewVoucher?.isImage ? (
            <Image
              source={{ uri: previewVoucher.url }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.docPreviewCard}>
              <Ionicons name="document-text-outline" size={60} color="#0d9488" style={{ marginBottom: 12 }} />
              <Text style={styles.docPreviewTitle}>{previewVoucher?.title}</Text>
              <Text style={styles.docPreviewSub}>Invoice document attached to this entry</Text>
            </View>
          )}

          <View style={styles.previewActionsRow}>
            <TouchableOpacity
              style={styles.downloadInvoiceBtn}
              activeOpacity={0.8}
              onPress={async () => {
                if (previewVoucher?.url) {
                  const filename = `Invoice_${Date.now()}.${previewVoucher.isImage ? 'jpg' : 'pdf'}`;
                  await downloadAndShareRemoteFile(previewVoucher.url, filename);
                }
              }}
            >
              <Ionicons name="download-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.openInBrowserBtnText}>Download Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.openInBrowserBtn}
              activeOpacity={0.8}
              onPress={() => {
                if (previewVoucher?.url) Linking.openURL(previewVoucher.url).catch(() => {});
              }}
            >
              <Ionicons name="open-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.openInBrowserBtnText}>Open Viewer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 13. Interactive Calendar Picker Modal */}
      <CalendarPickerModal
        visible={calendarPickerTarget !== null}
        title={
          calendarPickerTarget === 'filter_start'
            ? 'Select Filter Start Date'
            : calendarPickerTarget === 'filter_end'
            ? 'Select Filter End Date'
            : 'Select Expense Date'
        }
        initialDate={
          calendarPickerTarget === 'filter_start'
            ? startDateFilter
            : calendarPickerTarget === 'filter_end'
            ? endDateFilter
            : calendarPickerTarget === 'edit_date'
            ? editDate
            : ''
        }
        onSelectDate={(val) => {
          if (calendarPickerTarget === 'filter_start') {
            setStartDateFilter(val);
          } else if (calendarPickerTarget === 'filter_end') {
            setEndDateFilter(val);
          } else if (calendarPickerTarget === 'edit_date') {
            setEditDate(val);
          }
          setCalendarPickerTarget(null);
        }}
        onClose={() => setCalendarPickerTarget(null)}
      />

      {/* 14. Items Per Page Limit Selection Modal */}
      <Modal
        visible={isLimitModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLimitModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLimitModalOpen(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="options-outline" size={20} color="#0d9488" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Items Per Page</Text>
              </View>
              <TouchableOpacity onPress={() => setIsLimitModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 4 }}>
              {LIMIT_OPTIONS.map((lim) => {
                const isSelected = itemsPerPage === lim;
                return (
                  <TouchableOpacity
                    key={lim}
                    style={[
                      styles.limitSelectItem,
                      isSelected && styles.limitSelectItemActive
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setItemsPerPage(lim);
                      setCurrentPage(1);
                      setIsLimitModalOpen(false);
                    }}
                  >
                    <View style={styles.limitOptionLabelWrap}>
                      <Text style={[styles.limitSelectText, isSelected && styles.limitSelectTextActive]}>
                        {lim} expenditures
                      </Text>
                      {lim === 10 && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#0d9488" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 15. Persistent Bottom Navigation */}
      <BottomNav activeTab={internalTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 130
  },
  titleSection: {
    marginBottom: 16
  },
  screenHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden'
  },
  statCardLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6
  },
  statCardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    flexShrink: 1
  },
  shareCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden'
  },
  shareCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12
  },
  segmentedBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12
  },
  segmentItem: {
    height: '100%'
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '48%'
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    flexShrink: 0
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748b',
    flex: 1
  },
  filterSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 10
  },
  dropdownPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10
  },
  dropdownPillActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa'
  },
  dropdownPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155'
  },
  dropdownPillTextActive: {
    color: '#0d9488'
  },
  limitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
    minWidth: 78
  },
  exportRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  exportExcelBtn: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    paddingVertical: 9
  },
  exportExcelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#059669'
  },
  exportPdfBtn: {
    flex: 1,
    minWidth: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 9
  },
  exportPdfText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ef4444'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitleWithCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  countBadge: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0d9488'
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  expenseCardsContainer: {
    gap: 12
  },
  expenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden'
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8
  },
  cardAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
    flexShrink: 0
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    maxWidth: '55%',
    flexShrink: 1
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 10,
    flexShrink: 1
  },
  linkedBudgetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10
  },
  linkedBudgetText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500'
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 10
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardDateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8'
  },
  cardActionsGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyStateContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 240
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 30,
    zIndex: 999
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a'
  },
  categorySelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  categorySelectItemActive: {
    backgroundColor: '#f0fdfa'
  },
  categorySelectText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500'
  },
  categorySelectTextActive: {
    color: '#0d9488',
    fontWeight: '700'
  },
  dateInputGroup: {
    marginBottom: 14
  },
  datePickerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46
  },
  datePickerText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600'
  },
  datePlaceholderText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500'
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  presetChipText: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '700'
  },
  formGroup: {
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: '#0f172a'
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  categoryChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488'
  },
  categoryChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500'
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center'
  },
  modalSecondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569'
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0d9488',
    alignItems: 'center'
  },
  modalPrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff'
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10
  },
  fullscreenCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4
  },
  fullscreenImage: {
    width: '100%',
    height: '75%'
  },
  docPreviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%'
  },
  docPreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6
  },
  docPreviewSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center'
  },
  previewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20
  },
  downloadInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  openInBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  openInBrowserBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  },
  paginationContainer: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 12
  },
  paginationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  paginationCountText: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500'
  },
  paginationCountBold: {
    fontWeight: '700',
    color: '#0f172a'
  },
  limitSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  limitSelectorChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0d9488'
  },
  paginationNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8
  },
  pageNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 4
  },
  pageNavButtonDisabled: {
    opacity: 0.45,
    backgroundColor: '#f8fafc'
  },
  pageNavButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  pageNavButtonTextDisabled: {
    color: '#94a3b8'
  },
  pageNumbersList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 1
  },
  pageNumberPill: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  pageNumberPillActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  pageNumberPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  pageNumberPillTextActive: {
    color: '#ffffff'
  },
  pageEllipsisWrap: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageEllipsisText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700'
  },
  limitSelectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  limitSelectItemActive: {
    backgroundColor: '#f0fdfa',
    borderColor: '#0d9488'
  },
  limitOptionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  limitSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155'
  },
  limitSelectTextActive: {
    color: '#0d9488',
    fontWeight: '800'
  },
  defaultBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b'
  }
});
