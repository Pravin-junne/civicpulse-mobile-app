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
  ActivityIndicator,
  Platform,
  Image,
  AppState,
  Share,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MainHeader, BottomNav, CalendarPickerModal } from '../../components';
import api, { resolveFileUrl, API_BASE_URL } from '../../services/api';
import { exportCSVFile, exportPDFFile, downloadAndShareRemoteFile } from '../../utils/fileExport';

const formatINR = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
};

const formatDate = (dateStr) => {
  if (!dateStr) return '9/19/2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  } catch (e) {
    return '9/19/2026';
  }
};

/**
 * Flexible date parser for filter inputs (supports DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD/YY/MM)
 */
const parseFlexibleDate = (str) => {
  if (!str || !str.trim()) return null;
  const s = str.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const parts = s.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  // DD/MM/YYYY or DD/MM/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const parts = s.split('/');
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
    return new Date(y, m, d);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const WORK_CATEGORIES = [
  'Education',
  'Civil Works & Construction',
  'Electrical & Lighting',
  'Water Supply & Drainage',
  'Public Health & Sanitation',
  'IT & Office Admin',
  'Roads & Transport',
  'Other Constituency Works'
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

export default function BudgetScreen({
  navigation,
  activeTab = 'dashboard',
  onTabPress,
  onAddBudgetPress,
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

  // Active Sub-View: 'overview' | 'allocations' | 'consumption'
  const [currentView, setCurrentView] = useState('overview');

  // Filter Card Expansion State
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Data States
  const [budgets, setBudgets] = useState([]);
  const [consumptions, setConsumptions] = useState([]);
  const [fundingSources, setFundingSources] = useState([]);
  const [stats, setStats] = useState({
    totalAllocated: 0,
    totalConsumed: 0,
    remainingBudget: 0,
    utilizationPercentage: 0,
    sourceBreakdown: [],
    allocationBreakdown: []
  });

  // Filter States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSourceId, setFilterSourceId] = useState('');
  const [filterLimit, setFilterLimit] = useState(5);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  // Pagination States
  const [allocPage, setAllocPage] = useState(1);
  const [consPage, setConsPage] = useState(1);

  // Pickers and Modals
  const [showFilterSourcePicker, setShowFilterSourcePicker] = useState(false);
  const [showLimitPicker, setShowLimitPicker] = useState(false);
  const [showManageSourcesModal, setShowManageSourcesModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  // Record Consumption (Disburse) Modal State
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
  const [consBudgetId, setConsBudgetId] = useState('');
  const [consAmount, setConsAmount] = useState('');
  const [consTitle, setConsTitle] = useState('');
  const [consContractor, setConsContractor] = useState('');
  const [consBillNumber, setConsBillNumber] = useState('');
  const [consDate, setConsDate] = useState(new Date().toISOString().split('T')[0]);
  const [consRemarks, setConsRemarks] = useState('');
  const [consDocument, setConsDocument] = useState(null);
  const [isConsCalendarOpen, setIsConsCalendarOpen] = useState(false);
  const [isSubmittingCons, setIsSubmittingCons] = useState(false);

  // Edit Allocation Modal State
  const [isEditAllocModalOpen, setIsEditAllocModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editSourceId, setEditSourceId] = useState('');
  const [editAllocationDate, setEditAllocationDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAllocCalendarOpen, setIsAllocCalendarOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Edit Consumption Modal State
  const [isEditConsModalOpen, setIsEditConsModalOpen] = useState(false);
  const [editingCons, setEditingCons] = useState(null);
  const [editConsAmount, setEditConsAmount] = useState('');
  const [editConsTitle, setEditConsTitle] = useState('');
  const [editConsContractor, setEditConsContractor] = useState('');
  const [editConsBillNumber, setEditConsBillNumber] = useState('');
  const [editConsDate, setEditConsDate] = useState(new Date().toISOString().split('T')[0]);
  const [editConsRemarks, setEditConsRemarks] = useState('');
  const [editConsDocument, setEditConsDocument] = useState(null);
  const [isEditConsCalendarOpen, setIsEditConsCalendarOpen] = useState(false);
  const [isSubmittingEditCons, setIsSubmittingEditCons] = useState(false);

  // View Bill Modal State
  const [viewBillModalOpen, setViewBillModalOpen] = useState(false);
  const [selectedBillData, setSelectedBillData] = useState(null);

  // Active filter count calculator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterSourceId) count++;
    if (filterMinAmount) count++;
    if (filterMaxAmount) count++;
    if (filterStartDate) count++;
    if (filterEndDate) count++;
    if (filterLimit !== 5) count++;
    return count;
  }, [filterSourceId, filterMinAmount, filterMaxAmount, filterStartDate, filterEndDate, filterLimit]);

  // 1. Fetch All Data
  const fetchAllBudgetData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [budgetsRes, consumptionRes, statsRes, sourcesRes] = await Promise.allSettled([
        api.get('/budgets'),
        api.get('/budgets/consumption'),
        api.get('/budgets/stats'),
        api.get('/budgets/sources')
      ]);

      if (budgetsRes.status === 'fulfilled' && budgetsRes.value) {
        const raw = budgetsRes.value;
        const list = Array.isArray(raw) ? raw : (raw.budgets || []);
        setBudgets(list);
      }

      if (consumptionRes.status === 'fulfilled' && consumptionRes.value) {
        const raw = consumptionRes.value;
        const list = raw?.consumptions || (Array.isArray(raw) ? raw : []);
        setConsumptions(list);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats({
          totalAllocated: statsRes.value.totalAllocated || statsRes.value.totalBudget || 0,
          totalConsumed: statsRes.value.totalConsumed || statsRes.value.totalExpenses || 0,
          remainingBudget: statsRes.value.remainingBudget || 0,
          utilizationPercentage: statsRes.value.utilizationPercentage || 0,
          sourceBreakdown: statsRes.value.sourceBreakdown || [],
          allocationBreakdown: statsRes.value.allocationBreakdown || []
        });
      }

      if (sourcesRes.status === 'fulfilled' && sourcesRes.value) {
        const raw = sourcesRes.value;
        setFundingSources(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      console.warn('Budget data fetch notice:', err.message);
    } finally {
      setRefreshing(false);
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllBudgetData(false);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchAllBudgetData(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchAllBudgetData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllBudgetData();
  };

  const handleTabPress = (tabId) => {
    setInternalTab(tabId);
    if (onTabPress) onTabPress(tabId);
  };

  const handleCreateNew = () => {
    if (onAddBudgetPress) {
      onAddBudgetPress();
    } else if (navigation && navigation.navigate) {
      navigation.navigate('add_budget');
    }
  };

  // Funding Sources Management
  const handleCreateSource = async () => {
    if (!newSourceName.trim() || newSourceName.trim().length < 3) {
      Alert.alert('Validation Error', 'Please enter a funding source name (min 3 characters).');
      return;
    }

    setIsAddingSource(true);
    try {
      await api.post('/budgets/sources', { name: newSourceName.trim() });
      setNewSourceName('');
      fetchAllBudgetData(false);
      Alert.alert('Success', 'Funding source added successfully.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to add funding source.');
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleDeleteSource = (sourceId, sourceName) => {
    Alert.alert(
      'Remove Funding Source',
      `Are you sure you want to delete "${sourceName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/budgets/sources/${sourceId}`);
              if (filterSourceId && String(filterSourceId) === String(sourceId)) {
                setFilterSourceId('');
              }
              fetchAllBudgetData(false);
              Alert.alert('Success', `Funding source "${sourceName}" deleted.`);
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete funding source.');
            }
          }
        }
      ]
    );
  };

  // 2. Filter Logic for Allocations
  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      const q = filterSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (b.allocatedTo && b.allocatedTo.toLowerCase().includes(q)) ||
        (b.budgetName && b.budgetName.toLowerCase().includes(q)) ||
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.category && b.category.toLowerCase().includes(q)) ||
        (b.financialYear && b.financialYear.toLowerCase().includes(q)) ||
        (b.status && b.status.toLowerCase().includes(q)) ||
        (b.source?.name && b.source.name.toLowerCase().includes(q));

      const matchesSource = !filterSourceId || String(b.sourceId) === String(filterSourceId);
      const matchesMin = !filterMinAmount || b.amount >= parseFloat(filterMinAmount);
      const matchesMax = !filterMaxAmount || b.amount <= parseFloat(filterMaxAmount);

      // Date Range Filtering
      if (filterStartDate) {
        const startD = parseFlexibleDate(filterStartDate);
        if (startD && b.createdAt) {
          const itemDate = new Date(b.createdAt);
          if (itemDate < startD) return false;
        }
      }

      if (filterEndDate) {
        const endD = parseFlexibleDate(filterEndDate);
        if (endD && b.createdAt) {
          endD.setHours(23, 59, 59, 999);
          const itemDate = new Date(b.createdAt);
          if (itemDate > endD) return false;
        }
      }

      return matchesSearch && matchesSource && matchesMin && matchesMax;
    });
  }, [budgets, filterSearch, filterSourceId, filterMinAmount, filterMaxAmount, filterStartDate, filterEndDate]);

  // Paginated Allocations
  const totalAllocPages = Math.ceil(filteredBudgets.length / filterLimit) || 1;
  const paginatedBudgets = useMemo(() => {
    const start = (allocPage - 1) * filterLimit;
    return filteredBudgets.slice(start, start + filterLimit);
  }, [filteredBudgets, allocPage, filterLimit]);

  // 3. Filter Logic for Consumptions
  const filteredConsumptions = useMemo(() => {
    return consumptions.filter((c) => {
      const q = filterSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.contractorName && c.contractorName.toLowerCase().includes(q)) ||
        (c.billNumber && c.billNumber.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.remarks && c.remarks.toLowerCase().includes(q)) ||
        (c.budget?.budgetName && c.budget.budgetName.toLowerCase().includes(q)) ||
        (c.budget?.allocatedTo && c.budget.allocatedTo.toLowerCase().includes(q)) ||
        (c.budget?.source?.name && c.budget.source.name.toLowerCase().includes(q));

      const matchesSource =
        !filterSourceId || String(c.budget?.sourceId) === String(filterSourceId);
      const matchesMin = !filterMinAmount || c.amount >= parseFloat(filterMinAmount);
      const matchesMax = !filterMaxAmount || c.amount <= parseFloat(filterMaxAmount);

      // Date Range Filtering
      if (filterStartDate) {
        const startD = parseFlexibleDate(filterStartDate);
        if (startD && c.consumptionDate) {
          const itemDate = new Date(c.consumptionDate);
          if (itemDate < startD) return false;
        }
      }

      if (filterEndDate) {
        const endD = parseFlexibleDate(filterEndDate);
        if (endD && c.consumptionDate) {
          endD.setHours(23, 59, 59, 999);
          const itemDate = new Date(c.consumptionDate);
          if (itemDate > endD) return false;
        }
      }

      return matchesSearch && matchesSource && matchesMin && matchesMax;
    });
  }, [consumptions, filterSearch, filterSourceId, filterMinAmount, filterMaxAmount, filterStartDate, filterEndDate]);

  // Paginated Consumptions
  const totalConsPages = Math.ceil(filteredConsumptions.length / filterLimit) || 1;
  const paginatedConsumptions = useMemo(() => {
    const start = (consPage - 1) * filterLimit;
    return filteredConsumptions.slice(start, start + filterLimit);
  }, [filteredConsumptions, consPage, filterLimit]);

  // 5. Edit Allocation Handlers
  const openEditAllocation = (b) => {
    setEditingBudget(b);
    setEditAmount(b.amount ? String(b.amount) : '');
    setEditPurpose(b.allocatedTo || b.budgetName || '');
    setEditSourceId(
      b.sourceId
        ? String(b.sourceId)
        : fundingSources[0]?.id
        ? String(fundingSources[0].id)
        : ''
    );
    setEditAllocationDate(
      b.allocationDate
        ? new Date(b.allocationDate).toISOString().split('T')[0]
        : b.createdAt
        ? new Date(b.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setEditDescription(b.description || '');
    setIsEditAllocModalOpen(true);
  };

  const handleSaveEditAllocation = async () => {
    if (!editAmount || isNaN(parseFloat(editAmount)) || parseFloat(editAmount) <= 0) {
      Alert.alert('Required Field', 'Please enter a valid budget amount.');
      return;
    }
    const currentConsumed = Number(editingBudget?.consumedAmount) || 0;
    if (parseFloat(editAmount) < currentConsumed) {
      Alert.alert(
        'Invalid Amount',
        `Cannot reduce budget allocation below already disbursed amount (${formatINR(currentConsumed)}).`
      );
      return;
    }
    if (!editPurpose.trim() || editPurpose.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter the purpose / head (min 3 characters).');
      return;
    }
    if (!editSourceId) {
      Alert.alert('Required Field', 'Please select a funding source.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const payload = {
        amount: parseFloat(editAmount),
        sourceId: parseInt(editSourceId),
        allocatedTo: editPurpose.trim(),
        allocationDate: editAllocationDate ? new Date(editAllocationDate).toISOString() : new Date().toISOString(),
        description: editDescription.trim() || undefined
      };

      await api.put(`/budgets/${editingBudget.id}`, payload);
      Alert.alert('Success', 'Budget allocation updated successfully.');
      setIsEditAllocModalOpen(false);
      fetchAllBudgetData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to update budget allocation.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteAllocation = (b) => {
    Alert.alert(
      'Delete Budget Allocation',
      `Are you sure you want to delete "${b.allocatedTo || b.budgetName}"? Associated payouts will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/budgets/${b.id}`);
              fetchAllBudgetData();
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete budget allocation.');
            }
          }
        }
      ]
    );
  };

  // 6. Edit Consumption Handlers
  const handlePickEditConsCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take receipt photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setEditConsDocument({
          uri: asset.uri,
          name: `disbursement_${Date.now()}.jpg`,
          type: 'IMAGE',
          mimeType: 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera: ' + err.message);
    }
  };

  const handlePickEditConsGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo gallery access is required to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let name = asset.fileName;
        if (!name) {
          const parts = asset.uri.split('/');
          name = parts[parts.length - 1] || `disbursement_${Date.now()}.jpg`;
        }
        setEditConsDocument({
          uri: asset.uri,
          name,
          type: 'IMAGE',
          mimeType: asset.mimeType || 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not open gallery: ' + err.message);
    }
  };

  const handlePickEditConsDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const isImg = !!(doc.name && doc.name.match(/\.(jpg|jpeg|png|webp)$/i));
        setEditConsDocument({
          uri: doc.uri,
          name: doc.name,
          type: isImg ? 'IMAGE' : 'DOCUMENT',
          mimeType: doc.mimeType || 'application/pdf',
          isImage: isImg
        });
      }
    } catch (err) {
      Alert.alert('Document Error', 'Could not select document: ' + err.message);
    }
  };

  const openEditConsumption = (c) => {
    setEditingCons(c);
    setEditConsAmount(c.amount ? String(c.amount) : '');
    setEditConsTitle(c.title || '');
    setEditConsContractor(c.contractorName || '');
    setEditConsBillNumber(c.billNumber || '');
    setEditConsDate(
      c.consumptionDate
        ? new Date(c.consumptionDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setEditConsRemarks(c.remarks || '');
    setEditConsDocument(null);
    setIsEditConsModalOpen(true);
  };

  const handleSaveEditConsumption = async () => {
    if (!editConsAmount || isNaN(parseFloat(editConsAmount)) || parseFloat(editConsAmount) <= 0) {
      Alert.alert('Required Field', 'Please enter a valid disbursement amount in ₹.');
      return;
    }
    if (!editConsTitle.trim() || editConsTitle.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter the work title / purpose (min 3 chars).');
      return;
    }

    const selBudget = budgets.find((b) => String(b.id) === String(editingCons?.budgetId));
    if (selBudget) {
      const otherConsumed = Math.max(0, (Number(selBudget.consumedAmount) || 0) - (Number(editingCons.amount) || 0));
      const available = Math.max(0, (Number(selBudget.amount) || 0) - otherConsumed);
      if (parseFloat(editConsAmount) > available) {
        Alert.alert(
          'Exceeds Available Budget',
          `The updated disbursement amount (${formatINR(parseFloat(editConsAmount))}) exceeds the available budget balance (${formatINR(available)}).`
        );
        return;
      }
    }

    setIsSubmittingEditCons(true);
    try {
      const formData = new FormData();
      formData.append('amount', String(parseFloat(editConsAmount)));
      formData.append('title', editConsTitle.trim());
      if (editConsContractor.trim()) formData.append('contractorName', editConsContractor.trim());
      if (editConsBillNumber.trim()) formData.append('billNumber', editConsBillNumber.trim());
      if (editConsDate) formData.append('consumptionDate', new Date(editConsDate).toISOString());
      if (editConsRemarks.trim()) formData.append('remarks', editConsRemarks.trim());

      if (editConsDocument) {
        const fileUri = Platform.OS === 'android' ? editConsDocument.uri : editConsDocument.uri.replace('file://', '');
        let mimeType = editConsDocument.mimeType;
        if (!mimeType) {
          const ext = (editConsDocument.name.split('.').pop() || '').toLowerCase();
          if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'pdf') mimeType = 'application/pdf';
          else mimeType = 'application/octet-stream';
        }
        formData.append('document', {
          uri: fileUri,
          name: editConsDocument.name,
          type: mimeType
        });
      }

      await api.put(`/budgets/consumption/${editingCons.id}`, formData);
      Alert.alert('Success', 'Disbursement updated successfully.');
      setIsEditConsModalOpen(false);
      setEditConsDocument(null);
      fetchAllBudgetData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to update disbursement record.');
    } finally {
      setIsSubmittingEditCons(false);
    }
  };

  // 7. Disburse / Record Consumption Handlers
  const handlePickConsCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take receipt photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setConsDocument({
          uri: asset.uri,
          name: `disbursement_${Date.now()}.jpg`,
          type: 'IMAGE',
          mimeType: 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open camera: ' + err.message);
    }
  };

  const handlePickConsGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo gallery access is required to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.85
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let name = asset.fileName;
        if (!name) {
          const parts = asset.uri.split('/');
          name = parts[parts.length - 1] || `disbursement_${Date.now()}.jpg`;
        }
        setConsDocument({
          uri: asset.uri,
          name,
          type: 'IMAGE',
          mimeType: asset.mimeType || 'image/jpeg',
          isImage: true
        });
      }
    } catch (err) {
      Alert.alert('Gallery Error', 'Could not open gallery: ' + err.message);
    }
  };

  const handlePickConsDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const isImg = !!(doc.name && doc.name.match(/\.(jpg|jpeg|png|webp)$/i));
        setConsDocument({
          uri: doc.uri,
          name: doc.name,
          type: isImg ? 'IMAGE' : 'DOCUMENT',
          mimeType: doc.mimeType || 'application/pdf',
          isImage: isImg
        });
      }
    } catch (err) {
      Alert.alert('Document Error', 'Could not select document: ' + err.message);
    }
  };

  const openDisburseModal = (presetBudgetId = '') => {
    setConsBudgetId(
      presetBudgetId ? String(presetBudgetId) : budgets.length > 0 ? String(budgets[0].id) : ''
    );
    setConsAmount('');
    setConsTitle('');
    setConsContractor('');
    setConsBillNumber('');
    setConsDate(new Date().toISOString().split('T')[0]);
    setConsRemarks('');
    setConsDocument(null);
    setIsConsumptionModalOpen(true);
  };

  const handleSaveDisburse = async () => {
    if (!consBudgetId) {
      Alert.alert('Required Field', 'Please select a sanctioned budget source.');
      return;
    }
    if (!consAmount || isNaN(parseFloat(consAmount)) || parseFloat(consAmount) <= 0) {
      Alert.alert('Required Field', 'Please enter a valid disbursement amount in ₹.');
      return;
    }
    if (!consTitle.trim() || consTitle.trim().length < 3) {
      Alert.alert('Required Field', 'Please enter work title / purpose (min 3 characters).');
      return;
    }

    const selBudget = budgets.find((b) => String(b.id) === String(consBudgetId));
    const remBal = selBudget
      ? Math.max(0, (Number(selBudget.amount) || 0) - (Number(selBudget.consumedAmount) || 0))
      : Infinity;

    if (parseFloat(consAmount) > remBal && remBal !== Infinity) {
      Alert.alert(
        'Exceeds Available Budget',
        `The disbursement amount (${formatINR(parseFloat(consAmount))}) exceeds the available balance (${formatINR(remBal)}) of this budget allocation.`
      );
      return;
    }

    setIsSubmittingCons(true);
    try {
      const formData = new FormData();
      formData.append('budgetId', String(consBudgetId));
      formData.append('amount', String(parseFloat(consAmount)));
      formData.append('title', consTitle.trim());
      if (consContractor.trim()) formData.append('contractorName', consContractor.trim());
      if (consBillNumber.trim()) formData.append('billNumber', consBillNumber.trim());
      if (consDate) formData.append('consumptionDate', new Date(consDate).toISOString());
      if (consRemarks.trim()) formData.append('remarks', consRemarks.trim());

      if (consDocument) {
        const fileUri = Platform.OS === 'android' ? consDocument.uri : consDocument.uri.replace('file://', '');
        let mimeType = consDocument.mimeType;
        if (!mimeType) {
          const ext = (consDocument.name.split('.').pop() || '').toLowerCase();
          if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
          else if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'pdf') mimeType = 'application/pdf';
          else mimeType = 'application/octet-stream';
        }
        formData.append('document', {
          uri: fileUri,
          name: consDocument.name,
          type: mimeType
        });
      }

      await api.post('/budgets/consumption', formData);
      Alert.alert('Success', 'Disbursement recorded successfully.');
      setIsConsumptionModalOpen(false);
      setConsDocument(null);
      fetchAllBudgetData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to record disbursement.');
    } finally {
      setIsSubmittingCons(false);
    }
  };

  const handleDeleteConsumption = (c) => {
    Alert.alert(
      'Delete Consumption Record',
      `Delete payout record "${c.title}" of ${formatINR(c.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/budgets/consumption/${c.id}`);
              fetchAllBudgetData();
            } catch (err) {
              Alert.alert('Error', err.message || 'Unable to delete consumption record.');
            }
          }
        }
      ]
    );
  };

  const openViewBill = (c) => {
    setSelectedBillData(c);
    setViewBillModalOpen(true);
  };

  const clearFilters = () => {
    setFilterSearch('');
    setFilterSourceId('');
    setFilterLimit(5);
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
    setAllocPage(1);
    setConsPage(1);
  };

  const handleExport = async (format = 'Excel') => {
    if (isExporting) return;
    setIsExporting(true);

    const isAllocView = currentView === 'allocations';
    const isConsView = currentView === 'consumption';
    const isOverview = currentView === 'overview';

    // 1. Compile active filter summary string
    const activeFilterLabels = [];
    if (filterSearch.trim()) activeFilterLabels.push(`Search: "${filterSearch.trim()}"`);
    if (filterSourceId) {
      const srcObj = fundingSources.find((s) => String(s.id) === String(filterSourceId));
      if (srcObj) activeFilterLabels.push(`Source: "${srcObj.name}"`);
    }
    if (filterMinAmount) activeFilterLabels.push(`Min: ${formatINR(parseFloat(filterMinAmount))}`);
    if (filterMaxAmount) activeFilterLabels.push(`Max: ${formatINR(parseFloat(filterMaxAmount))}`);
    if (filterStartDate) activeFilterLabels.push(`From: ${filterStartDate}`);
    if (filterEndDate) activeFilterLabels.push(`To: ${filterEndDate}`);
    const filterSummaryStr = activeFilterLabels.length > 0 ? activeFilterLabels.join(' | ') : 'All Records (No Filters)';

    // Filtered Financial Totals
    const fAllocTotal = filteredBudgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const fConsumedFromAlloc = filteredBudgets.reduce((sum, b) => {
      const cAmt = (b.consumptions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0) || Number(b.consumedAmount) || 0;
      return sum + cAmt;
    }, 0);
    const fRemainingFromAlloc = Math.max(0, fAllocTotal - fConsumedFromAlloc);
    const fConsTotal = filteredConsumptions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const baseFilename = `Budget_${isConsView ? 'Disbursements' : 'Allocations'}_${Date.now()}`;

    // Build URL query params
    const queryParams = new URLSearchParams();
    if (filterSearch.trim()) queryParams.append('search', filterSearch.trim());
    if (filterSourceId) queryParams.append('sourceId', filterSourceId);
    if (filterMinAmount) queryParams.append('minAmount', filterMinAmount);
    if (filterMaxAmount) queryParams.append('maxAmount', filterMaxAmount);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

    try {
      if (format === 'Excel') {
        const endpoint = isConsView
          ? `${API_BASE_URL}/budgets/consumption/export/excel${qs}`
          : `${API_BASE_URL}/budgets/export/excel${qs}`;

        try {
          await downloadAndShareRemoteFile(endpoint, `${baseFilename}.xlsx`);
        } catch (remoteErr) {
          console.warn('Backend Excel download failed, falling back to local CSV file:', remoteErr);
          let exportCsvContent = '';
          if (isConsView) {
            const csvConsRows = filteredConsumptions.map((c) => {
              const bHead = c.budget?.allocatedTo || c.budget?.budgetName || 'General';
              const bSource = c.budget?.source?.name || 'N/A';
              return `"${c.id}","${(c.title || '').replace(/"/g, '""')}","${bHead.replace(/"/g, '""')}","${bSource.replace(/"/g, '""')}","${(c.contractorName || 'N/A').replace(/"/g, '""')}","${c.amount || 0}","${c.consumptionDate ? formatDate(c.consumptionDate) : ''}","${(c.billNumber || 'N/A').replace(/"/g, '""')}","${(c.remarks || '').replace(/"/g, '""')}"`;
            }).join('\n');
            exportCsvContent = `Payout ID,Work Title,Budget Source,Funding Authority,Contractor,Amount (INR),Date,Bill No,Remarks\n` + csvConsRows;
          } else {
            const csvAllocRows = filteredBudgets.map((b) => {
              const consumed = (b.consumptions || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || Number(b.consumedAmount) || 0;
              const rem = Math.max(0, (Number(b.amount) || 0) - consumed);
              return `"${b.id}","${(b.allocatedTo || b.budgetName || '').replace(/"/g, '""')}","${(b.source?.name || 'General').replace(/"/g, '""')}","${(b.category || 'Development').replace(/"/g, '""')}","${b.amount || 0}","${consumed}","${rem}","${b.status || 'ACTIVE'}","${formatDate(b.createdAt)}"`;
            }).join('\n');
            exportCsvContent = `ID,Budget Source,Source Authority,Category,Allocated Amount (INR),Consumed Amount (INR),Remaining Balance (INR),Status,Date Created\n` + csvAllocRows;
          }
          await exportCSVFile(`${baseFilename}.csv`, exportCsvContent);
        }
      } else {
        // PDF or Report
        const endpoint = isConsView
          ? `${API_BASE_URL}/budgets/consumption/export/pdf${qs}`
          : `${API_BASE_URL}/budgets/export/pdf${qs}`;

        try {
          await downloadAndShareRemoteFile(endpoint, `${baseFilename}.pdf`);
        } catch (remoteErr) {
          console.warn('Backend PDF download failed, generating device-side PDF file:', remoteErr);
          const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8" />
                <title>Budget & Expenditure Statement</title>
                <style>
                  @page { size: A4 landscape; margin: 10mm 8mm; }
                  * { box-sizing: border-box; }
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 10px; color: #1e293b; background: #ffffff; }
                  .header { border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 12px; }
                  h1 { color: #4338ca; font-size: 18px; margin: 0 0 4px 0; }
                  .meta { font-size: 10px; color: #64748b; margin-bottom: 10px; }
                  .summary-cards { display: flex; gap: 8px; margin-bottom: 12px; }
                  .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #f8fafc; }
                  .card-title { font-size: 9.5px; text-transform: uppercase; color: #64748b; font-weight: bold; }
                  .card-val { font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 2px; }
                  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9px; table-layout: fixed; }
                  th { background: #f1f5f9; color: #334155; padding: 6px 4px; text-align: left; font-weight: 700; border: 1px solid #cbd5e1; word-break: break-word; overflow-wrap: break-word; }
                  td { padding: 5px 4px; border: 1px solid #e2e8f0; text-align: left; word-break: break-word; overflow-wrap: break-word; vertical-align: top; }
                  tr:nth-child(even) { background: #fafafa; }
                  .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h1>🏛️ Office of Kunal Tilak — Budget & Expenditure Statement</h1>
                  <div class="meta">
                    <strong>Generated:</strong> ${new Date().toLocaleString()} | <strong>Filter:</strong> ${filterSummaryStr}
                  </div>
                </div>

                <div class="summary-cards">
                  <div class="card">
                    <div class="card-title">Filtered Budget</div>
                    <div class="card-val">${formatINR(fAllocTotal)}</div>
                  </div>
                  <div class="card">
                    <div class="card-title">Utilized / Consumed</div>
                    <div class="card-val">${formatINR(fConsumedFromAlloc)}</div>
                  </div>
                  <div class="card">
                    <div class="card-title">Remaining Balance</div>
                    <div class="card-val">${formatINR(fRemainingFromAlloc)}</div>
                  </div>
                </div>

                ${(isAllocView || isOverview) ? `
                  <h3 style="color: #4338ca; margin-top: 14px; margin-bottom: 4px; font-size: 13px;">
                    💰 Budget Allocations (${filteredBudgets.length} Records)
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 7%;">ID</th>
                        <th style="width: 25%;">Budget Source / Purpose</th>
                        <th style="width: 16%;">Authority</th>
                        <th style="width: 14%;">Category</th>
                        <th style="width: 13%; text-align: right;">Allocated (₹)</th>
                        <th style="width: 12%; text-align: right;">Consumed (₹)</th>
                        <th style="width: 13%; text-align: right;">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredBudgets.map(b => {
                        const consumed = (b.consumptions || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || Number(b.consumedAmount) || 0;
                        const rem = Math.max(0, (Number(b.amount) || 0) - consumed);
                        return `
                          <tr>
                            <td>#${b.id}</td>
                            <td><strong>${b.allocatedTo || b.budgetName || '—'}</strong></td>
                            <td>${b.source?.name || 'General'}</td>
                            <td>${b.category || 'Development'}</td>
                            <td style="text-align: right; font-weight: bold; color: #4338ca;">₹${(b.amount || 0).toLocaleString('en-IN')}</td>
                            <td style="text-align: right; color: #b45309;">₹${consumed.toLocaleString('en-IN')}</td>
                            <td style="text-align: right; font-weight: bold; color: #047857;">₹${rem.toLocaleString('en-IN')}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                ` : ''}

                ${(isConsView || isOverview) ? `
                  <h3 style="color: #c2410c; margin-top: 18px; margin-bottom: 4px; font-size: 13px;">
                    💸 Disbursements & Consumptions (${filteredConsumptions.length} Records)
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 7%;">ID</th>
                        <th style="width: 26%;">Work Title / Purpose</th>
                        <th style="width: 18%;">Linked Source</th>
                        <th style="width: 16%;">Contractor / Payee</th>
                        <th style="width: 11%;">Bill No</th>
                        <th style="width: 12%; text-align: right;">Amount (₹)</th>
                        <th style="width: 10%; text-align: center;">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredConsumptions.map(c => `
                        <tr>
                          <td>#${c.id}</td>
                          <td><strong>${c.title}</strong></td>
                          <td>${c.budget?.allocatedTo || c.budget?.budgetName || 'General'}</td>
                          <td>${c.contractorName || '—'}</td>
                          <td>${c.billNumber || '—'}</td>
                          <td style="text-align: right; font-weight: bold; color: #c2410c;">₹${(c.amount || 0).toLocaleString('en-IN')}</td>
                          <td style="text-align: center;">${c.consumptionDate ? formatDate(c.consumptionDate) : '—'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : ''}

                <div class="footer">लोकप्रतिनिधी कार्यालय / Office of Kunal Tilak — Budget Portal</div>
              </body>
            </html>
          `;
          await exportPDFFile(`${baseFilename}.pdf`, htmlContent);
        }
      }
    } catch (err) {
      console.error('Export handling error:', err);
      Alert.alert('Export Error', err.message || 'Could not complete export.');
    } finally {
      setIsExporting(false);
    }
  };


  // Live Snapshot calculations
  const totalAllocated =
    stats.totalAllocated || budgets.reduce((acc, b) => acc + (b.amount || 0), 0);
  const totalConsumed =
    stats.totalConsumed || consumptions.reduce((acc, c) => acc + (c.amount || 0), 0);
  const remainingBalance = Math.max(0, totalAllocated - totalConsumed);

  // Authority & Purpose Bars (Strictly Live Data - Zero Mock Fallback)
  const authorityList = useMemo(() => {
    if (stats.sourceBreakdown && stats.sourceBreakdown.length > 0) {
      return stats.sourceBreakdown;
    }
    if (budgets && budgets.length > 0) {
      const map = {};
      budgets.forEach((b) => {
        const s = b.fundingSource?.name || b.fundingSourceName || b.source || 'General Fund';
        map[s] = (map[s] || 0) + (Number(b.amount) || 0);
      });
      return Object.keys(map).map((k) => ({ source: k, amount: map[k] }));
    }
    if (fundingSources && fundingSources.length > 0) {
      return fundingSources.map((s) => ({ source: s.name, amount: 0 }));
    }
    return [];
  }, [stats.sourceBreakdown, budgets, fundingSources]);

  const purposeList = useMemo(() => {
    if (stats.allocationBreakdown && stats.allocationBreakdown.length > 0) {
      return stats.allocationBreakdown;
    }
    if (budgets && budgets.length > 0) {
      const map = {};
      budgets.forEach((b) => {
        const p = b.allocatedTo || b.purpose || 'General';
        map[p] = (map[p] || 0) + (Number(b.amount) || 0);
      });
      return Object.keys(map).map((k) => ({ allocatedTo: k, amount: map[k] }));
    }
    return [];
  }, [stats.allocationBreakdown, budgets]);

  const maxAuthAmt = Math.max(...authorityList.map((a) => a.amount || 0), 1);
  const maxPurpAmt = Math.max(...purposeList.map((p) => p.amount || 0), 1);
  const colorPalettes = ['#0d9488', '#2563eb', '#f59e0b', '#8b5cf6', '#10b981'];

  /**
   * Reusable Collapsible Filter Toolbar Component
   */
  const renderFilterCard = (showDates = false) => (
    <View style={styles.card}>
      {/* Search Budgets Header + Filter Toggle Button */}
      <View style={styles.filterGroup}>
        <View style={styles.filterHeaderRow}>
          <Text style={styles.filterLabel}>SEARCH BUDGETS</Text>
          {activeFilterCount > 0 && (
            <View style={styles.activeFilterCountPill}>
              <Text style={styles.activeFilterCountText}>{activeFilterCount} Active</Text>
            </View>
          )}
        </View>

        <View style={styles.searchBoxWithTune}>
          <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { flex: 1 }]}
            placeholder="Search by purpose, description..."
            placeholderTextColor="#94a3b8"
            value={filterSearch}
            onChangeText={(t) => {
              setFilterSearch(t);
              setAllocPage(1);
              setConsPage(1);
            }}
          />

          {/* Interactive Filter Icon Button */}
          <TouchableOpacity
            style={[
              styles.filterToggleIconBtn,
              (isFilterExpanded || activeFilterCount > 0) && styles.filterToggleIconBtnActive
            ]}
            onPress={() => setIsFilterExpanded((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFilterExpanded ? 'chevron-up' : 'options-outline'}
              size={18}
              color={isFilterExpanded || activeFilterCount > 0 ? '#ea580c' : '#475569'}
            />
            {activeFilterCount > 0 && !isFilterExpanded && (
              <View style={styles.filterBadgeDot} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Expandable Filter Fields Panel */}
      {isFilterExpanded && (
        <View style={styles.filterExpandedSection}>
          {/* Row 1: Funding Source & Limit */}
          <View style={styles.minMaxRow}>
            <View style={[styles.filterGroup, { flex: 1.2 }]}>
              <Text style={styles.filterLabel}>FUNDING SOURCE</Text>
              <TouchableOpacity
                style={styles.filterSelectBox}
                activeOpacity={0.7}
                onPress={() => setShowFilterSourcePicker(true)}
              >
                <Text style={styles.filterSelectText} numberOfLines={1}>
                  {filterSourceId
                    ? fundingSources.find((s) => String(s.id) === String(filterSourceId))
                        ?.name || '-- All Sources --'
                    : '-- All Sources --'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={[styles.filterGroup, { flex: 0.8 }]}>
              <Text style={styles.filterLabel}>LIMIT</Text>
              <TouchableOpacity
                style={styles.filterSelectBox}
                activeOpacity={0.7}
                onPress={() => setShowLimitPicker(true)}
              >
                <Text style={styles.filterSelectText}>Max Limit {filterLimit}</Text>
                <Ionicons name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Optional Row 2: Start Date & End Date */}
          {showDates && (
            <View style={styles.minMaxRow}>
              <View style={[styles.filterGroup, { flex: 1 }]}>
                <Text style={styles.filterLabel}>START DATE</Text>
                <View style={styles.filterInputBox}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color="#64748b"
                    style={{ marginRight: 6 }}
                  />
                  <TextInput
                    style={styles.filterTextInput}
                    placeholder="DD/YY/MM"
                    placeholderTextColor="#94a3b8"
                    value={filterStartDate}
                    onChangeText={(t) => {
                      setFilterStartDate(t);
                      setAllocPage(1);
                      setConsPage(1);
                    }}
                  />
                </View>
              </View>

              <View style={[styles.filterGroup, { flex: 1 }]}>
                <Text style={styles.filterLabel}>END DATE</Text>
                <View style={styles.filterInputBox}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color="#64748b"
                    style={{ marginRight: 6 }}
                  />
                  <TextInput
                    style={styles.filterTextInput}
                    placeholder="DD/YY/MM"
                    placeholderTextColor="#94a3b8"
                    value={filterEndDate}
                    onChangeText={(t) => {
                      setFilterEndDate(t);
                      setAllocPage(1);
                      setConsPage(1);
                    }}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Row 3: Min & Max Amount */}
          <View style={styles.minMaxRow}>
            <View style={[styles.filterGroup, { flex: 1 }]}>
              <Text style={styles.filterLabel}>MIN AMOUNT</Text>
              <View style={styles.filterInputBox}>
                <TextInput
                  style={styles.filterTextInput}
                  placeholder="Min ₹"
                  placeholderTextColor="#94a3b8"
                  value={filterMinAmount}
                  onChangeText={(t) => {
                    setFilterMinAmount(t);
                    setAllocPage(1);
                    setConsPage(1);
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[styles.filterGroup, { flex: 1 }]}>
              <Text style={styles.filterLabel}>MAX AMOUNT</Text>
              <View style={styles.filterInputBox}>
                <TextInput
                  style={styles.filterTextInput}
                  placeholder="Max ₹"
                  placeholderTextColor="#94a3b8"
                  value={filterMaxAmount}
                  onChangeText={(t) => {
                    setFilterMaxAmount(t);
                    setAllocPage(1);
                    setConsPage(1);
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Action Buttons: Clear, Export Excel, Export PDF */}
          <View style={styles.filterActionsRow}>
            <TouchableOpacity
              style={styles.clearBtn}
              activeOpacity={0.7}
              onPress={clearFilters}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportExcelBtn, isExporting && { opacity: 0.6 }]}
              activeOpacity={0.8}
              disabled={isExporting}
              onPress={() => handleExport('Excel')}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />
              ) : (
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={styles.exportActionText}>Export Excel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportPdfBtn, isExporting && { opacity: 0.6 }]}
              activeOpacity={0.8}
              disabled={isExporting}
              onPress={() => handleExport('PDF')}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 4 }} />
              ) : (
                <Ionicons
                  name="document-outline"
                  size={14}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={styles.exportActionText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const fabBottomOffset = Math.max(90, (insets.bottom || 0) + 72);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Global Portal Header */}
      <MainHeader
        unreadCount={unreadCount}
        onOpenDrawer={onOpenDrawer}
        onOpenNotifications={onOpenNotifications}
        onOpenProfile={onOpenProfile}
      />

      {/* View Segment Switcher Tabs */}
      <View style={styles.viewTabsRow}>
        <TouchableOpacity
          style={[styles.viewTabBtn, currentView === 'overview' && styles.viewTabBtnActive]}
          onPress={() => setCurrentView('overview')}
        >
          <Text
            style={[
              styles.viewTabBtnText,
              currentView === 'overview' && styles.viewTabBtnTextActive
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewTabBtn, currentView === 'allocations' && styles.viewTabBtnActive]}
          onPress={() => {
            setCurrentView('allocations');
            setAllocPage(1);
          }}
        >
          <Text
            style={[
              styles.viewTabBtnText,
              currentView === 'allocations' && styles.viewTabBtnTextActive
            ]}
          >
            Allocations ({budgets.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewTabBtn, currentView === 'consumption' && styles.viewTabBtnActive]}
          onPress={() => {
            setCurrentView('consumption');
            setConsPage(1);
          }}
        >
          <Text
            style={[
              styles.viewTabBtnText,
              currentView === 'consumption' && styles.viewTabBtnTextActive
            ]}
          >
            Consumption ({consumptions.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
        }
      >
        {/* ========================================================================= */}
        {/* VIEW 1: OVERVIEW SCREEN (IMAGE 3)                                         */}
        {/* ========================================================================= */}
        {currentView === 'overview' && (
          <>
            {/* Page Header: Budget Management + New Button */}
            <View style={styles.pageHeaderRow}>
              <Text style={styles.pageTitle}>Budget Management</Text>
              <TouchableOpacity
                style={styles.newButton}
                activeOpacity={0.85}
                onPress={handleCreateNew}
              >
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={styles.newButtonText}>New</Text>
              </TouchableOpacity>
            </View>

            {/* 1. BUDGET OVERVIEW - Total Budget Snapshot Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardSuperTitle}>BUDGET OVERVIEW</Text>
                  <Text style={styles.cardMainTitle}>Total Budget Snapshot</Text>
                </View>
                <TouchableOpacity
                  style={[styles.exportPillBtn, isExporting && { opacity: 0.6 }]}
                  activeOpacity={0.7}
                  disabled={isExporting}
                  onPress={() => handleExport('Report')}
                >
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#475569" style={{ marginRight: 4 }} />
                  ) : (
                    <Ionicons
                      name="download-outline"
                      size={14}
                      color="#475569"
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text style={styles.exportPillText}>Export</Text>
                </TouchableOpacity>
              </View>

              {/* Blue Allocated Banner Box */}
              <View style={styles.blueSnapshotBanner}>
                <View style={styles.blueWalletIconBox}>
                  <Ionicons name="wallet-outline" size={24} color="#ffffff" />
                </View>
                <View style={styles.blueBannerContent}>
                  <Text style={styles.blueBannerAmount} adjustsFontSizeToFit numberOfLines={1}>
                    {formatINR(totalAllocated)}
                  </Text>
                  <Text style={styles.blueBannerLabel}>Total Budget Allocated</Text>
                </View>
              </View>

              {/* Side-by-Side KPI Boxes: Consumed & Remaining */}
              <View style={styles.kpiRow}>
                {/* Box 1: Consumed */}
                <View style={styles.consumedKpiBox}>
                  <View style={styles.kpiHeaderRow}>
                    <Ionicons name="trending-up" size={16} color="#ea580c" />
                    <Text style={styles.consumedKpiLabel}>Consumed</Text>
                  </View>
                  <Text style={styles.consumedKpiAmount} adjustsFontSizeToFit numberOfLines={1}>
                    {formatINR(totalConsumed)}
                  </Text>
                  <Text style={styles.consumedKpiSub}>Total Budget Consumed</Text>
                </View>

                {/* Box 2: Remaining */}
                <View style={styles.remainingKpiBox}>
                  <View style={styles.kpiHeaderRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                    <Text style={styles.remainingKpiLabel}>Remaining</Text>
                  </View>
                  <Text style={styles.remainingKpiAmount} adjustsFontSizeToFit numberOfLines={1}>
                    {formatINR(remainingBalance)}
                  </Text>
                  <Text style={styles.remainingKpiSub}>Remaining Balance</Text>
                </View>
              </View>
            </View>

            {/* 2. Funding Sources (By Authority) Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardSectionHeading}>Funding Sources (By Authority)</Text>
                <TouchableOpacity
                  style={styles.manageSourcesHeaderBtn}
                  activeOpacity={0.7}
                  onPress={() => setShowManageSourcesModal(true)}
                >
                  <Ionicons name="settings-outline" size={13} color="#ea580c" />
                  <Text style={styles.manageSourcesHeaderBtnText}>Manage Sources</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.barsList}>
                {authorityList.length === 0 ? (
                  <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '500' }}>
                      No funding source allocations recorded (₹0)
                    </Text>
                  </View>
                ) : (
                  authorityList.map((item, idx) => {
                    const pct = Math.min(100, Math.round(((item.amount || 0) / maxAuthAmt) * 100));
                    const barColor = colorPalettes[idx % colorPalettes.length];
                    return (
                      <View key={item.source || idx} style={styles.barItemWrap}>
                        <View style={styles.barItemHeader}>
                          <Text style={styles.barItemName} numberOfLines={1}>{item.source}</Text>
                          <Text style={styles.barItemAmount}>{formatINR(item.amount)}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${pct}%`, backgroundColor: barColor }
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* 3. Allocation by Purpose Card */}
            <View style={styles.card}>
              <Text style={styles.cardSectionHeading}>Allocation by Purpose</Text>
              <View style={styles.barsList}>
                {purposeList.length === 0 ? (
                  <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '500' }}>
                      No allocation purposes recorded (₹0)
                    </Text>
                  </View>
                ) : (
                  purposeList.map((item, idx) => {
                    const pct = Math.min(100, Math.round(((item.amount || 0) / maxPurpAmt) * 100));
                    const barColor = colorPalettes[idx % colorPalettes.length];
                    return (
                      <View key={item.allocatedTo || idx} style={styles.barItemWrap}>
                        <View style={styles.barItemHeader}>
                          <Text style={styles.barItemName} numberOfLines={1}>{item.allocatedTo}</Text>
                          <Text style={styles.barItemAmount}>{formatINR(item.amount)}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${pct}%`, backgroundColor: barColor }
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* 4. Collapsible Filter Toolbar Card */}
            {renderFilterCard(false)}

            {/* 5. Budget Allocations Section */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Budget Allocations</Text>
                  <Text style={styles.sectionSub}>Sanctioned MLA/MP & Ward funds</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.addBudgetSquareBtn}
                    activeOpacity={0.85}
                    onPress={handleCreateNew}
                  >
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentView('allocations');
                      setAllocPage(1);
                    }}
                  >
                    <Text style={styles.viewAllText}>VIEW ALL</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Overview Allocations Preview Cards (first 2-3) */}
              {filteredBudgets.slice(0, 3).map((b) => (
                <View key={b.id} style={styles.allocationCard}>
                  {/* Top Row: #ID & Date */}
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemIdText}>#{b.id}</Text>
                    <Text style={styles.itemDateText}>{formatDate(b.createdAt)}</Text>
                  </View>

                  {/* Data Rows */}
                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Sanctioned Amount</Text>
                    <Text style={styles.dataAmountOrange}>{formatINR(b.amount)}</Text>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Funding Source</Text>
                    <Text style={styles.dataValueBold} numberOfLines={1}>{b.source?.name || 'Corporate CSR'}</Text>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Purpose / Budget Source</Text>
                    <View style={styles.purposeBadge}>
                      <Text style={styles.purposeBadgeText} numberOfLines={1}>
                        {(b.budgetName || b.allocatedTo || 'EDUCATION').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Consumed / Committed</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.dataAmountOrange}>
                        {formatINR(b.consumedAmount || 0)}
                      </Text>
                      {Number(b.eventAllocatedAmount) > 0 && (
                        <Text style={{ fontSize: 11, color: '#6366f1', fontWeight: '700', marginTop: 2 }}>
                          (Events: {formatINR(b.eventAllocatedAmount)})
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Available Balance</Text>
                    <Text
                      style={[
                        styles.dataValueBold,
                        {
                          color:
                            (Number(b.amount || 0) - Number(b.consumedAmount || 0)) > 0
                              ? '#16a34a'
                              : '#dc2626'
                        }
                      ]}
                    >
                      {formatINR(
                        Math.max(0, Number(b.amount || 0) - Number(b.consumedAmount || 0))
                      )}
                    </Text>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.allocActionsRow}>
                    <TouchableOpacity
                      style={styles.disburseBtn}
                      activeOpacity={0.7}
                      onPress={() => openDisburseModal(b.id)}
                    >
                      <Ionicons
                        name="paper-plane-outline"
                        size={15}
                        color="#ea580c"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.disburseBtnText}>Disburse</Text>
                    </TouchableOpacity>

                    <View style={styles.allocRightBtns}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.7}
                        onPress={() => openEditAllocation(b)}
                      >
                        <Ionicons name="create-outline" size={16} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, styles.deleteActionBtn]}
                        activeOpacity={0.7}
                        onPress={() => handleDeleteAllocation(b)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              {filteredBudgets.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No budget allocations found.</Text>
                </View>
              )}
            </View>

            {/* 6. Budget Consumption Section */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Budget Consumption</Text>
                  <Text style={styles.sectionSub}>Recorded disbursements and payouts</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.addBudgetSquareBtn}
                    activeOpacity={0.85}
                    onPress={() => openDisburseModal()}
                  >
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentView('consumption');
                      setConsPage(1);
                    }}
                  >
                    <Text style={styles.viewAllText}>VIEW ALL</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Overview Consumptions Preview Cards */}
              {filteredConsumptions.slice(0, 3).map((c) => (
                <View key={c.id} style={styles.consumptionCard}>
                  {/* Top Row: #ID Tag Date */}
                  <View style={styles.itemTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Text style={styles.itemIdText}>#{c.id}</Text>
                      <View style={styles.purposeBadge}>
                        <Text style={styles.purposeBadgeText} numberOfLines={1}>
                          {(
                            c.budget?.budgetName ||
                            c.budget?.allocatedTo ||
                            'EDUCATION'
                          ).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemDateText}>{formatDate(c.consumptionDate)}</Text>
                  </View>

                  {/* Work Title */}
                  <Text style={styles.consTitleText} numberOfLines={2}>{c.title || 'Office cost'}</Text>

                  {/* Payee / Bill and Amount */}
                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel} numberOfLines={1}>
                      {c.billNumber ? `Bill/WO No: ${c.billNumber}` : `Payee: ${c.contractorName || '—'}`}
                    </Text>
                    <Text style={styles.dataAmountOrange}>{formatINR(c.amount)}</Text>
                  </View>

                  {/* Attachment Link & Actions */}
                  <View style={styles.consBottomRow}>
                    {c.documentUrl ? (
                      <TouchableOpacity
                        style={styles.viewBillLinkBtn}
                        onPress={() => openViewBill(c)}
                      >
                        <Ionicons
                          name="image-outline"
                          size={15}
                          color="#2563eb"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.viewBillLinkText}>View Bill</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.attachmentNotice}>No attachment</Text>
                    )}

                    <View style={styles.allocRightBtns}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.7}
                        onPress={() => openEditConsumption(c)}
                      >
                        <Ionicons name="create-outline" size={16} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, styles.deleteActionBtn]}
                        activeOpacity={0.7}
                        onPress={() => handleDeleteConsumption(c)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              {filteredConsumptions.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No budget payouts recorded yet.</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: ALL BUDGET ALLOCATIONS SCREEN (IMAGE 2)                           */}
        {/* ========================================================================= */}
        {currentView === 'allocations' && (
          <>
            {/* Filter Card with Search Tune Button, Limit, Dates */}
            {renderFilterCard(true)}

            {/* Section Header: Budget Allocations + Add Budget */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Budget Allocations</Text>
                  <Text style={styles.sectionSub}>Sanctioned MLA/MP & Ward funds</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.manageSourcesOutlineBtn}
                    activeOpacity={0.8}
                    onPress={() => setShowManageSourcesModal(true)}
                  >
                    <Ionicons name="settings-outline" size={14} color="#64748b" />
                    <Text style={styles.manageSourcesOutlineBtnText}>Sources</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.addBudgetBtn}
                    activeOpacity={0.85}
                    onPress={handleCreateNew}
                  >
                    <Ionicons name="add" size={16} color="#ffffff" />
                    <Text style={styles.addBudgetBtnText}>Add Budget</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* List of Allocation Cards */}
              {paginatedBudgets.map((b) => (
                <View key={b.id} style={styles.allocationCard}>
                  {/* Top Row: #ID & Date */}
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemIdText}>#{b.id}</Text>
                    <Text style={styles.itemDateText}>{formatDate(b.createdAt)}</Text>
                  </View>

                  {/* Data Rows */}
                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Sanctioned Amount</Text>
                    <Text style={styles.dataAmountOrange}>{formatINR(b.amount)}</Text>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Funding Source</Text>
                    <Text style={styles.dataValueBold} numberOfLines={1}>{b.source?.name || 'Corporate CSR'}</Text>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Purpose / Budget Source</Text>
                    <View style={styles.purposeBadge}>
                      <Text style={styles.purposeBadgeText} numberOfLines={1}>
                        {(b.budgetName || b.allocatedTo || 'EDUCATION').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Consumed / Committed</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.dataAmountOrange}>
                        {formatINR(b.consumedAmount || 0)}
                      </Text>
                      {Number(b.eventAllocatedAmount) > 0 && (
                        <Text style={{ fontSize: 11, color: '#6366f1', fontWeight: '700', marginTop: 2 }}>
                          (Events: {formatINR(b.eventAllocatedAmount)})
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel}>Available Balance</Text>
                    <Text
                      style={[
                        styles.dataValueBold,
                        {
                          color:
                            (Number(b.amount || 0) - Number(b.consumedAmount || 0)) > 0
                              ? '#16a34a'
                              : '#dc2626'
                        }
                      ]}
                    >
                      {formatINR(
                        Math.max(0, Number(b.amount || 0) - Number(b.consumedAmount || 0))
                      )}
                    </Text>
                  </View>

                  {/* Action Buttons Row */}
                  <View style={styles.allocActionsRow}>
                    <TouchableOpacity
                      style={styles.disburseBtn}
                      activeOpacity={0.7}
                      onPress={() => openDisburseModal(b.id)}
                    >
                      <Ionicons
                        name="paper-plane-outline"
                        size={15}
                        color="#ea580c"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.disburseBtnText}>Disburse</Text>
                    </TouchableOpacity>

                    <View style={styles.allocRightBtns}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.7}
                        onPress={() => openEditAllocation(b)}
                      >
                        <Ionicons name="create-outline" size={16} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, styles.deleteActionBtn]}
                        activeOpacity={0.7}
                        onPress={() => handleDeleteAllocation(b)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              {filteredBudgets.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No budget allocations found matching filters.</Text>
                </View>
              )}

              {/* Pagination Controls */}
              {filteredBudgets.length > 0 && (
                <View style={styles.paginationContainer}>
                  <Text style={styles.paginationSummaryText}>
                    Showing {Math.min(filteredBudgets.length, (allocPage - 1) * filterLimit + 1)} to{' '}
                    {Math.min(filteredBudgets.length, allocPage * filterLimit)} of{' '}
                    {filteredBudgets.length} entries
                  </Text>
                  <View style={styles.paginationButtonsRow}>
                    <TouchableOpacity
                      style={[styles.pageNavBtn, allocPage <= 1 && styles.pageNavBtnDisabled]}
                      onPress={() => setAllocPage((p) => Math.max(1, p - 1))}
                      disabled={allocPage <= 1}
                    >
                      <Text style={styles.pageNavBtnText}>‹ Prev</Text>
                    </TouchableOpacity>

                    {Array.from({ length: totalAllocPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isActive = allocPage === pageNum;
                      return (
                        <TouchableOpacity
                          key={pageNum}
                          style={[styles.pageNumberBtn, isActive && styles.pageNumberBtnActive]}
                          onPress={() => setAllocPage(pageNum)}
                        >
                          <Text
                            style={[
                              styles.pageNumberBtnText,
                              isActive && styles.pageNumberBtnTextActive
                            ]}
                          >
                            {pageNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={[
                        styles.pageNavBtn,
                        allocPage >= totalAllocPages && styles.pageNavBtnDisabled
                      ]}
                      onPress={() => setAllocPage((p) => Math.min(totalAllocPages, p + 1))}
                      disabled={allocPage >= totalAllocPages}
                    >
                      <Text style={styles.pageNavBtnText}>Next ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: ALL BUDGET CONSUMPTION SCREEN (IMAGE 1)                           */}
        {/* ========================================================================= */}
        {currentView === 'consumption' && (
          <>
            {/* Page Header: Budget Management + New Button */}
            <View style={styles.pageHeaderRow}>
              <Text style={styles.pageTitle}>Budget Management</Text>
              <TouchableOpacity
                style={styles.newButton}
                activeOpacity={0.85}
                onPress={handleCreateNew}
              >
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={styles.newButtonText}>New</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Card: Search, Funding Source, Limit, Min, Max */}
            {renderFilterCard(false)}

            {/* Section Header: Budget Consumption + Record */}
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>Budget Consumption</Text>
                  <Text style={styles.sectionSub}>Recorded disbursements and payouts</Text>
                </View>
                <TouchableOpacity
                  style={styles.recordBtn}
                  activeOpacity={0.85}
                  onPress={() => openDisburseModal()}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                  <Text style={styles.recordBtnText}>Record</Text>
                </TouchableOpacity>
              </View>

              {/* List of Consumption Cards */}
              {paginatedConsumptions.map((c) => (
                <View key={c.id} style={styles.consumptionCard}>
                  {/* Top Row: #ID Tag Date */}
                  <View style={styles.itemTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Text style={styles.itemIdText}>#{c.id}</Text>
                      <View style={styles.purposeBadge}>
                        <Text style={styles.purposeBadgeText} numberOfLines={1}>
                          {(
                            c.budget?.budgetName ||
                            c.budget?.allocatedTo ||
                            'EDUCATION'
                          ).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.itemDateText}>{formatDate(c.consumptionDate)}</Text>
                  </View>

                  {/* Work Title */}
                  <Text style={styles.consTitleText} numberOfLines={2}>{c.title || 'Office cost'}</Text>

                  {/* Payee / Bill and Amount */}
                  <View style={styles.itemDataRow}>
                    <Text style={styles.dataLabel} numberOfLines={1}>
                      {c.billNumber ? `Bill/WO No: ${c.billNumber}` : `Payee: ${c.contractorName || '—'}`}
                    </Text>
                    <Text style={styles.dataAmountOrange}>{formatINR(c.amount)}</Text>
                  </View>

                  {/* Attachment Link & Actions */}
                  <View style={styles.consBottomRow}>
                    {c.documentUrl ? (
                      <TouchableOpacity
                        style={styles.viewBillLinkBtn}
                        onPress={() => openViewBill(c)}
                      >
                        <Ionicons
                          name="image-outline"
                          size={15}
                          color="#2563eb"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.viewBillLinkText}>View Bill</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.attachmentNotice}>No attachment</Text>
                    )}

                    <View style={styles.allocRightBtns}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        activeOpacity={0.7}
                        onPress={() => openEditConsumption(c)}
                      >
                        <Ionicons name="create-outline" size={16} color="#475569" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.iconActionBtn, styles.deleteActionBtn]}
                        activeOpacity={0.7}
                        onPress={() => handleDeleteConsumption(c)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              {filteredConsumptions.length === 0 && (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No budget payouts recorded yet.</Text>
                </View>
              )}

              {/* Pagination Controls */}
              {filteredConsumptions.length > 0 && (
                <View style={styles.paginationContainer}>
                  <Text style={styles.paginationSummaryText}>
                    Showing {Math.min(filteredConsumptions.length, (consPage - 1) * filterLimit + 1)}{' '}
                    to {Math.min(filteredConsumptions.length, consPage * filterLimit)} of{' '}
                    {filteredConsumptions.length} entries
                  </Text>
                  <View style={styles.paginationButtonsRow}>
                    <TouchableOpacity
                      style={[styles.pageNavBtn, consPage <= 1 && styles.pageNavBtnDisabled]}
                      onPress={() => setConsPage((p) => Math.max(1, p - 1))}
                      disabled={consPage <= 1}
                    >
                      <Text style={styles.pageNavBtnText}>‹ Prev</Text>
                    </TouchableOpacity>

                    {Array.from({ length: totalConsPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isActive = consPage === pageNum;
                      return (
                        <TouchableOpacity
                          key={pageNum}
                          style={[styles.pageNumberBtn, isActive && styles.pageNumberBtnActive]}
                          onPress={() => setConsPage(pageNum)}
                        >
                          <Text
                            style={[
                              styles.pageNumberBtnText,
                              isActive && styles.pageNumberBtnTextActive
                            ]}
                          >
                            {pageNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={[
                        styles.pageNavBtn,
                        consPage >= totalConsPages && styles.pageNavBtnDisabled
                      ]}
                      onPress={() => setConsPage((p) => Math.min(totalConsPages, p + 1))}
                      disabled={consPage >= totalConsPages}
                    >
                      <Text style={styles.pageNavBtnText}>Next ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Floating Action Button (Teal Plus icon above bottom nav) */}
      <TouchableOpacity
        style={[styles.fabButton, { bottom: fabBottomOffset }]}
        activeOpacity={0.85}
        onPress={handleCreateNew}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>

      {/* Bottom Navigation */}
      <BottomNav activeTab={internalTab} onTabPress={handleTabPress} />

      {/* ----------------- MODALS ----------------- */}

      {/* Funding Source Picker Modal */}
      <Modal
        visible={showFilterSourcePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterSourcePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterSourcePicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Filter by Funding Source</Text>
              <TouchableOpacity onPress={() => setShowFilterSourcePicker(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.pickerItem, !filterSourceId && styles.pickerItemSelected]}
                onPress={() => {
                  setFilterSourceId('');
                  setAllocPage(1);
                  setConsPage(1);
                  setShowFilterSourcePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    !filterSourceId && { fontWeight: '800', color: '#ea580c' }
                  ]}
                >
                  -- All Sources --
                </Text>
              </TouchableOpacity>
              {fundingSources.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.pickerItem,
                    String(filterSourceId) === String(s.id) && styles.pickerItemSelected
                  ]}
                  onPress={() => {
                    setFilterSourceId(String(s.id));
                    setAllocPage(1);
                    setConsPage(1);
                    setShowFilterSourcePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      String(filterSourceId) === String(s.id) && {
                        fontWeight: '800',
                        color: '#ea580c'
                      }
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.manageSourcesModalFooterBtn}
              activeOpacity={0.8}
              onPress={() => {
                setShowFilterSourcePicker(false);
                setShowManageSourcesModal(true);
              }}
            >
              <Ionicons name="settings-outline" size={15} color="#ea580c" />
              <Text style={styles.manageSourcesModalFooterText}>Manage / Add / Remove Sources</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Manage Funding Sources Modal (Add & Remove Sources) */}
      <Modal
        visible={showManageSourcesModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isAddingSource) setShowManageSourcesModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 580 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Manage Funding Sources</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Create or remove funding sources
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowManageSourcesModal(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Add New Source Form */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.modalLabel}>
                New Funding Source Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="e.g. MLA Local Area Dev Fund"
                  placeholderTextColor="#94a3b8"
                  value={newSourceName}
                  onChangeText={setNewSourceName}
                  editable={!isAddingSource}
                />
                <TouchableOpacity
                  style={[styles.addSourceSubmitBtn, isAddingSource && { opacity: 0.7 }]}
                  activeOpacity={0.8}
                  onPress={handleCreateSource}
                  disabled={isAddingSource}
                >
                  {isAddingSource ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.addSourceSubmitBtnText}>+ Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Existing Sources List with Delete Action */}
            <Text style={[styles.modalLabel, { fontSize: 12, color: '#64748b', marginBottom: 8 }]}>
              ACTIVE FUNDING SOURCES ({fundingSources.length})
            </Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {fundingSources.map((s) => (
                <View key={s.id} style={styles.manageSourceItemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.manageSourceNameText} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s._count?.budgets !== undefined && (
                      <Text style={styles.manageSourceCountText}>
                        {s._count.budgets} allocation{s._count.budgets !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteSourceIconBtn}
                    activeOpacity={0.7}
                    onPress={() => handleDeleteSource(s.id, s.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={17} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {fundingSources.length === 0 && (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#94a3b8' }}>No funding sources configured.</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: 14 }]}
              onPress={() => setShowManageSourcesModal(false)}
            >
              <Text style={styles.modalCancelBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Limit Picker Modal */}
      <Modal
        visible={showLimitPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLimitPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLimitPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Entries Per Page</Text>
              <TouchableOpacity onPress={() => setShowLimitPicker(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            {LIMIT_OPTIONS.map((lim) => (
              <TouchableOpacity
                key={lim}
                style={[styles.pickerItem, filterLimit === lim && styles.pickerItemSelected]}
                onPress={() => {
                  setFilterLimit(lim);
                  setAllocPage(1);
                  setConsPage(1);
                  setShowLimitPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    filterLimit === lim && { fontWeight: '800', color: '#ea580c' }
                  ]}
                >
                  Max Limit {lim}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Disburse (Record Consumption) Modal */}
      <Modal
        visible={isConsumptionModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingCons) setIsConsumptionModalOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { maxHeight: 600 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Record Disbursement</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Payout against budget allocation</Text>
              </View>
              <TouchableOpacity onPress={() => setIsConsumptionModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* Linked Budget Source Summary Banner */}
              {(() => {
                const selBudget = budgets.find((b) => String(b.id) === String(consBudgetId)) || budgets[0];
                const totalAlloc = Number(selBudget?.amount || 0);
                const totalCons = Number(selBudget?.consumedAmount || 0);
                const remBal = selBudget ? Math.max(0, totalAlloc - totalCons) : 0;
                const enteredAmt = parseFloat(consAmount) || 0;
                const isOverBudget = enteredAmt > remBal;
                const projectedRem = remBal - enteredAmt;

                return (
                  <View
                    style={{
                      backgroundColor: isOverBudget ? '#fef2f2' : '#f0fdf4',
                      borderWidth: 1,
                      borderColor: isOverBudget ? '#fecaca' : '#bbf7d0',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 12
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: '800',
                          color: isOverBudget ? '#991b1b' : '#166534',
                          flex: 1,
                          marginRight: 8
                        }}
                        numberOfLines={1}
                      >
                        {selBudget?.budgetName || selBudget?.allocatedTo || 'General Source'}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: isOverBudget ? '#b91c1c' : '#15803d',
                          backgroundColor: isOverBudget ? '#fee2e2' : '#dcfce7',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4
                        }}
                      >
                        {selBudget?.source?.name || 'Constituency Fund'}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: isOverBudget ? '#fecaca' : '#dcfce7',
                        paddingTop: 6
                      }}
                    >
                      <Text style={{ fontSize: 12, color: isOverBudget ? '#991b1b' : '#15803d' }}>
                        Available Balance:
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: isOverBudget ? '#991b1b' : '#15803d' }}>
                        {formatINR(remBal)}
                      </Text>
                    </View>
                    {enteredAmt > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 4
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            color: isOverBudget ? '#dc2626' : '#475569',
                            fontWeight: isOverBudget ? '700' : '500'
                          }}
                        >
                          {isOverBudget ? 'Exceeds Allocation By:' : 'Balance After Disbursement:'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isOverBudget ? '#dc2626' : '#16a34a'
                          }}
                        >
                          {formatINR(Math.abs(projectedRem))}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Linked Budget Source Selector (if more than 1 budget) */}
              {budgets.length > 1 && (
                <View style={styles.modalFieldWrap}>
                  <Text style={styles.modalLabel}>
                    Select Budget Source <Text style={{ color: '#ef4444' }}>*</Text>
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginVertical: 4 }}
                  >
                    {budgets.map((b) => {
                      const isSelected = String(consBudgetId) === String(b.id);
                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={[styles.modalOptionPill, isSelected && styles.modalOptionPillActive]}
                          onPress={() => setConsBudgetId(String(b.id))}
                        >
                          <Text
                            style={[
                              styles.modalOptionPillText,
                              isSelected && styles.modalOptionPillTextActive
                            ]}
                          >
                            {b.allocatedTo || `Budget #${b.id}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Amount */}
              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Disbursement Amount (₹) <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 50000"
                  placeholderTextColor="#94a3b8"
                  value={consAmount}
                  onChangeText={setConsAmount}
                  keyboardType="numeric"
                />
              </View>

              {/* Disbursement Date */}
              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Disbursement Date <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.modalInput,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setIsConsCalendarOpen(true)}
                >
                  <Text style={{ fontSize: 14, color: consDate ? '#0f172a' : '#94a3b8' }}>
                    {consDate || 'Select Date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#ea580c" />
                </TouchableOpacity>
              </View>

              {/* Work Scope / Title */}
              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Work Scope / Purpose <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Office Laptops Purchase / Drainage Work"
                  placeholderTextColor="#94a3b8"
                  value={consTitle}
                  onChangeText={setConsTitle}
                />
              </View>

              {/* Payee / Contractor */}
              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Paid To / Vendor Name (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Dell Vendors / Pravin Builders"
                  placeholderTextColor="#94a3b8"
                  value={consContractor}
                  onChangeText={setConsContractor}
                />
              </View>

              {/* Bill / WO No. */}
              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Bill / Invoice / WO No. (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 101 or INV-2026-089"
                  placeholderTextColor="#94a3b8"
                  value={consBillNumber}
                  onChangeText={setConsBillNumber}
                />
              </View>

              {/* Remarks */}
              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Remarks (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Additional notes..."
                  placeholderTextColor="#94a3b8"
                  value={consRemarks}
                  onChangeText={setConsRemarks}
                  multiline
                />
              </View>

              {/* Optional Document / Image Upload */}
              <View style={styles.modalFieldWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.modalLabel}>Add Document / Image (Optional)</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8' }}>OPTIONAL</Text>
                </View>

                {consDocument ? (
                  <View style={styles.attachedDocCard}>
                    <View style={styles.attachedDocInfo}>
                      <Ionicons
                        name={consDocument.isImage ? 'image-outline' : 'document-text-outline'}
                        size={22}
                        color="#ea580c"
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.attachedDocName} numberOfLines={1}>
                          {consDocument.name}
                        </Text>
                        <Text style={styles.attachedDocType}>
                          {consDocument.isImage ? 'Photo / Image' : 'Document File'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeDocBtn}
                      onPress={() => setConsDocument(null)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.docPickerButtonsRow}>
                    <TouchableOpacity
                      style={styles.docPickActionBtn}
                      activeOpacity={0.7}
                      onPress={handlePickConsCamera}
                    >
                      <Ionicons name="camera-outline" size={16} color="#ea580c" />
                      <Text style={styles.docPickActionText}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docPickActionBtn}
                      activeOpacity={0.7}
                      onPress={handlePickConsGallery}
                    >
                      <Ionicons name="images-outline" size={16} color="#2563eb" />
                      <Text style={[styles.docPickActionText, { color: '#2563eb' }]}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docPickActionBtn}
                      activeOpacity={0.7}
                      onPress={handlePickConsDocument}
                    >
                      <Ionicons name="document-attach-outline" size={16} color="#0d9488" />
                      <Text style={[styles.docPickActionText, { color: '#0d9488' }]}>Document</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsConsumptionModalOpen(false)}
                disabled={isSubmittingCons}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {(() => {
                const selBudget = budgets.find((b) => String(b.id) === String(consBudgetId)) || budgets[0];
                const remBal = selBudget ? Math.max(0, (Number(selBudget.amount) || 0) - (Number(selBudget.consumedAmount) || 0)) : 0;
                const isOver = Boolean((parseFloat(consAmount) || 0) > remBal);
                const isDisabled = Boolean(isSubmittingCons || isOver);

                return (
                  <TouchableOpacity
                    style={[
                      styles.modalSubmitBtn,
                      isDisabled && { opacity: 0.5, backgroundColor: isOver ? '#94a3b8' : '#ea580c' }
                    ]}
                    onPress={handleSaveDisburse}
                    disabled={Boolean(isDisabled)}
                  >
                    {isSubmittingCons ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalSubmitBtnText}>
                        {isOver ? 'Exceeds Allocation' : 'Record Disburse'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Budget Allocation Modal */}
      <Modal
        visible={isEditAllocModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingEdit) setIsEditAllocModalOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { maxHeight: 520 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Edit Budget Allocation</Text>
              <TouchableOpacity onPress={() => setIsEditAllocModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {editingBudget && Number(editingBudget.consumedAmount || 0) > 0 && (
                <View
                  style={{
                    backgroundColor: '#fffbeb',
                    borderWidth: 1,
                    borderColor: '#fde68a',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 12
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>
                    Already Disbursed: {formatINR(editingBudget.consumedAmount)}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                    Allocation amount cannot be reduced below already disbursed funds.
                  </Text>
                </View>
              )}

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Amount (₹) <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 350000"
                  placeholderTextColor="#94a3b8"
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Allocated Purpose <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Education / Corporate CSR"
                  placeholderTextColor="#94a3b8"
                  value={editPurpose}
                  onChangeText={setEditPurpose}
                />
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Funding Source <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginVertical: 4 }}
                >
                  {fundingSources.map((s) => {
                    const isSelected = String(editSourceId) === String(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.modalOptionPill, isSelected && styles.modalOptionPillActive]}
                        onPress={() => setEditSourceId(String(s.id))}
                      >
                        <Text
                          style={[
                            styles.modalOptionPillText,
                            isSelected && styles.modalOptionPillTextActive
                          ]}
                        >
                          {s.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Allocation Date <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  activeOpacity={0.7}
                  onPress={() => setIsAllocCalendarOpen(true)}
                >
                  <Text style={{ fontSize: 14, color: editAllocationDate ? '#0f172a' : '#94a3b8' }}>
                    {editAllocationDate || 'Select Date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#ea580c" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Details about this budget allocation..."
                  placeholderTextColor="#94a3b8"
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditAllocModalOpen(false)}
                disabled={isSubmittingEdit}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {(() => {
                const isBelowConsumed = Boolean(
                  editingBudget &&
                  (parseFloat(editAmount) || 0) < Number(editingBudget.consumedAmount || 0)
                );
                const isDisabled = Boolean(isSubmittingEdit || isBelowConsumed);

                return (
                  <TouchableOpacity
                    style={[
                      styles.modalSubmitBtn,
                      isDisabled && { opacity: 0.5, backgroundColor: isBelowConsumed ? '#94a3b8' : '#ea580c' }
                    ]}
                    onPress={handleSaveEditAllocation}
                    disabled={Boolean(isDisabled)}
                  >
                    {isSubmittingEdit ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalSubmitBtnText}>
                        {isBelowConsumed ? 'Below Disbursed' : 'Save Changes'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Budget Consumption Modal */}
      <Modal
        visible={isEditConsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingEditCons) setIsEditConsModalOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { maxHeight: 560 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Edit Disbursement</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Update disbursement record</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditConsModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {(() => {
                const targetBudget = budgets.find((b) => String(b.id) === String(editingCons?.budgetId));
                if (!targetBudget) return null;
                const otherConsumed = Math.max(
                  0,
                  (Number(targetBudget.consumedAmount) || 0) - (Number(editingCons?.amount) || 0)
                );
                const availableForThis = Math.max(
                  0,
                  (Number(targetBudget.amount) || 0) - otherConsumed
                );
                const currentEntered = parseFloat(editConsAmount) || 0;
                const isOver = currentEntered > availableForThis;

                return (
                  <View
                    style={{
                      backgroundColor: isOver ? '#fef2f2' : '#f0fdf4',
                      borderWidth: 1,
                      borderColor: isOver ? '#fecaca' : '#bbf7d0',
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 12
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: isOver ? '#991b1b' : '#166534',
                          flex: 1
                        }}
                      >
                        {targetBudget.budgetName || targetBudget.allocatedTo || 'Budget Source'}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: isOver ? '#991b1b' : '#166534'
                        }}
                      >
                        Max Available: {formatINR(availableForThis)}
                      </Text>
                    </View>
                    {currentEntered > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginTop: 6,
                          borderTopWidth: 1,
                          borderTopColor: isOver ? '#fecaca' : '#dcfce7',
                          paddingTop: 4
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11.5,
                            color: isOver ? '#dc2626' : '#475569',
                            fontWeight: isOver ? '700' : '500'
                          }}
                        >
                          {isOver ? 'Exceeds limit by:' : 'Balance After Update:'}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isOver ? '#dc2626' : '#16a34a'
                          }}
                        >
                          {formatINR(Math.abs(availableForThis - currentEntered))}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Amount (₹) <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 50000"
                  placeholderTextColor="#94a3b8"
                  value={editConsAmount}
                  onChangeText={setEditConsAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Disbursement Date <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.modalInput,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setIsEditConsCalendarOpen(true)}
                >
                  <Text style={{ fontSize: 14, color: editConsDate ? '#0f172a' : '#94a3b8' }}>
                    {editConsDate || 'Select Date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#ea580c" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>
                  Work Scope / Purpose <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Office cost"
                  placeholderTextColor="#94a3b8"
                  value={editConsTitle}
                  onChangeText={setEditConsTitle}
                />
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Paid To / Vendor Name (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Dell Vendors"
                  placeholderTextColor="#94a3b8"
                  value={editConsContractor}
                  onChangeText={setEditConsContractor}
                />
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Bill / Invoice / WO No. (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 101"
                  placeholderTextColor="#94a3b8"
                  value={editConsBillNumber}
                  onChangeText={setEditConsBillNumber}
                />
              </View>

              <View style={styles.modalFieldWrap}>
                <Text style={styles.modalLabel}>Remarks (Optional)</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Additional notes..."
                  placeholderTextColor="#94a3b8"
                  value={editConsRemarks}
                  onChangeText={setEditConsRemarks}
                  multiline
                />
              </View>

              {/* Optional Document / Image Upload */}
              <View style={styles.modalFieldWrap}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.modalLabel}>Attach Document / Image (Optional)</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8' }}>OPTIONAL</Text>
                </View>

                {editConsDocument ? (
                  <View style={styles.attachedDocCard}>
                    <View style={styles.attachedDocInfo}>
                      <Ionicons
                        name={editConsDocument.isImage ? 'image-outline' : 'document-text-outline'}
                        size={22}
                        color="#ea580c"
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.attachedDocName} numberOfLines={1}>
                          {editConsDocument.name}
                        </Text>
                        <Text style={styles.attachedDocType}>New Attachment</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeDocBtn}
                      onPress={() => setEditConsDocument(null)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : editingCons?.documentUrl ? (
                  <View style={{ marginBottom: 8 }}>
                    <View style={[styles.attachedDocCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                      <View style={styles.attachedDocInfo}>
                        <Ionicons name="document-text-outline" size={22} color="#16a34a" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.attachedDocName, { color: '#166534' }]} numberOfLines={1}>
                            Current Document Attached
                          </Text>
                          <Text style={[styles.attachedDocType, { color: '#15803d' }]}>Tap buttons below to replace</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.docPickerButtonsRow, { marginTop: 6 }]}>
                      <TouchableOpacity
                        style={styles.docPickActionBtn}
                        activeOpacity={0.7}
                        onPress={handlePickEditConsCamera}
                      >
                        <Ionicons name="camera-outline" size={16} color="#ea580c" />
                        <Text style={styles.docPickActionText}>Camera</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.docPickActionBtn}
                        activeOpacity={0.7}
                        onPress={handlePickEditConsGallery}
                      >
                        <Ionicons name="images-outline" size={16} color="#2563eb" />
                        <Text style={[styles.docPickActionText, { color: '#2563eb' }]}>Gallery</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.docPickActionBtn}
                        activeOpacity={0.7}
                        onPress={handlePickEditConsDocument}
                      >
                        <Ionicons name="document-attach-outline" size={16} color="#0d9488" />
                        <Text style={[styles.docPickActionText, { color: '#0d9488' }]}>Document</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.docPickerButtonsRow}>
                    <TouchableOpacity
                      style={styles.docPickActionBtn}
                      activeOpacity={0.7}
                      onPress={handlePickEditConsCamera}
                    >
                      <Ionicons name="camera-outline" size={16} color="#ea580c" />
                      <Text style={styles.docPickActionText}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docPickActionBtn}
                      activeOpacity={0.7}
                      onPress={handlePickEditConsGallery}
                    >
                      <Ionicons name="images-outline" size={16} color="#2563eb" />
                      <Text style={[styles.docPickActionText, { color: '#2563eb' }]}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docPickActionBtn}
                      activeOpacity={0.7}
                      onPress={handlePickEditConsDocument}
                    >
                      <Ionicons name="document-attach-outline" size={16} color="#0d9488" />
                      <Text style={[styles.docPickActionText, { color: '#0d9488' }]}>Document</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditConsModalOpen(false)}
                disabled={isSubmittingEditCons}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              {(() => {
                const targetBudget = budgets.find((b) => String(b.id) === String(editingCons?.budgetId));
                let isOver = false;
                if (targetBudget) {
                  const otherConsumed = Math.max(
                    0,
                    (Number(targetBudget.consumedAmount) || 0) - (Number(editingCons?.amount) || 0)
                  );
                  const availableForThis = Math.max(
                    0,
                    (Number(targetBudget.amount) || 0) - otherConsumed
                  );
                  isOver = Boolean((parseFloat(editConsAmount) || 0) > availableForThis);
                }
                const isDisabled = Boolean(isSubmittingEditCons || isOver);

                return (
                  <TouchableOpacity
                    style={[
                      styles.modalSubmitBtn,
                      isDisabled && { opacity: 0.5, backgroundColor: isOver ? '#94a3b8' : '#ea580c' }
                    ]}
                    onPress={handleSaveEditConsumption}
                    disabled={Boolean(isDisabled)}
                  >
                    {isSubmittingEditCons ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.modalSubmitBtnText}>
                        {isOver ? 'Exceeds Allocation' : 'Save Changes'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* View Bill Modal */}
      <Modal
        visible={viewBillModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewBillModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360 }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Work Order / Invoice Details</Text>
              <TouchableOpacity onPress={() => setViewBillModalOpen(false)}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            {selectedBillData && (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
                  {selectedBillData.title}
                </Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  Bill / WO No: {selectedBillData.billNumber || '101'}
                </Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  Payee: {selectedBillData.contractorName || 'Dell Vendors'}
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#ea580c', marginTop: 10 }}>
                  {formatINR(selectedBillData.amount)}
                </Text>
                {selectedBillData.documentUrl ? (
                  <Image
                    source={{ uri: resolveFileUrl(selectedBillData.documentUrl) }}
                    style={{
                      width: '100%',
                      height: 180,
                      borderRadius: 8,
                      marginTop: 12,
                      backgroundColor: '#f1f5f9'
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={{
                      padding: 20,
                      backgroundColor: '#f8fafc',
                      borderRadius: 8,
                      alignItems: 'center',
                      marginTop: 12
                    }}
                  >
                    <Ionicons name="document-text-outline" size={32} color="#94a3b8" />
                    <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                      Verified Digitally Sanctioned Invoice
                    </Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: 14 }]}
              onPress={() => setViewBillModalOpen(false)}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Allocation Date Calendar Modal */}
      <CalendarPickerModal
        visible={isAllocCalendarOpen}
        initialDate={editAllocationDate || new Date().toISOString().split('T')[0]}
        title="Select Allocation Date"
        onSelectDate={(val) => {
          if (val) setEditAllocationDate(val);
          setIsAllocCalendarOpen(false);
        }}
        onClose={() => setIsAllocCalendarOpen(false)}
      />

      {/* Disburse Date Calendar Modal */}
      <CalendarPickerModal
        visible={isConsCalendarOpen}
        initialDate={consDate || new Date().toISOString().split('T')[0]}
        title="Select Disbursement Date"
        onSelectDate={(val) => {
          if (val) setConsDate(val);
          setIsConsCalendarOpen(false);
        }}
        onClose={() => setIsConsCalendarOpen(false)}
      />

      {/* Edit Disburse Date Calendar Modal */}
      <CalendarPickerModal
        visible={isEditConsCalendarOpen}
        initialDate={editConsDate || new Date().toISOString().split('T')[0]}
        title="Select Disbursement Date"
        onSelectDate={(val) => {
          if (val) setEditConsDate(val);
          setIsEditConsCalendarOpen(false);
        }}
        onClose={() => setIsEditConsCalendarOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  viewTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8
  },
  viewTabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9'
  },
  viewTabBtnActive: {
    backgroundColor: '#0f172a'
  },
  viewTabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b'
  },
  viewTabBtnTextActive: {
    color: '#ffffff'
  },
  container: {
    flex: 1
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 20
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 8
  },
  cardSuperTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  cardMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  exportPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    flexShrink: 0
  },
  exportPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  blueSnapshotBanner: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    overflow: 'hidden'
  },
  blueWalletIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0
  },
  blueBannerContent: {
    flex: 1,
    minWidth: 0
  },
  blueBannerAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3730a3',
    letterSpacing: -0.5,
    flexShrink: 1
  },
  blueBannerLabel: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    marginTop: 2
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10
  },
  consumedKpiBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffedd5',
    overflow: 'hidden'
  },
  remainingKpiBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    overflow: 'hidden'
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6
  },
  consumedKpiLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  remainingKpiLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16a34a'
  },
  consumedKpiAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: -0.3,
    flexShrink: 1
  },
  remainingKpiAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: -0.3,
    flexShrink: 1
  },
  consumedKpiSub: {
    fontSize: 10,
    color: '#9a3412',
    fontWeight: '500',
    marginTop: 4
  },
  remainingKpiSub: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '500',
    marginTop: 4
  },
  cardSectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12
  },
  barsList: {
    gap: 12
  },
  barItemWrap: {
    gap: 5
  },
  barItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  barItemName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    minWidth: 0
  },
  barItemAmount: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    flexShrink: 0
  },
  barTrack: {
    height: 7,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 4
  },
  filterGroup: {
    marginBottom: 10
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  filterLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  activeFilterCountPill: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  activeFilterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c'
  },
  searchBoxWithTune: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 42
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  filterToggleIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  filterToggleIconBtnActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74'
  },
  filterBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ea580c'
  },
  filterExpandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  filterSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 40
  },
  filterSelectText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155'
  },
  minMaxRow: {
    flexDirection: 'row',
    gap: 10
  },
  filterInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 40
  },
  filterTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a'
  },
  filterActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  clearBtn: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    flexShrink: 0
  },
  clearBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  exportExcelBtn: {
    flex: 1,
    minWidth: 105,
    flexDirection: 'row',
    height: 38,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  exportPdfBtn: {
    flex: 1,
    minWidth: 105,
    flexDirection: 'row',
    height: 38,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  exportActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
  },
  sectionWrap: {
    marginTop: 6,
    marginBottom: 16
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  sectionSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.3
  },
  addBudgetSquareBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    flexShrink: 0
  },
  addBudgetBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff'
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    flexShrink: 0
  },
  recordBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff'
  },
  allocationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden'
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8
  },
  itemIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0
  },
  itemDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    flexShrink: 0
  },
  itemDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3.5,
    gap: 8
  },
  dataLabel: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 0,
    maxWidth: '55%'
  },
  dataAmountOrange: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
    flexShrink: 0,
    textAlign: 'right'
  },
  dataValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    minWidth: 0,
    textAlign: 'right'
  },
  purposeBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
    maxWidth: '65%',
    flexShrink: 1
  },
  purposeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6366f1',
    letterSpacing: 0.5
  },
  allocActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8
  },
  disburseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    flexShrink: 0
  },
  disburseBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  allocRightBtns: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteActionBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2'
  },
  consumptionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden'
  },
  consTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
    flexShrink: 1
  },
  consBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  attachmentNotice: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  viewBillLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  viewBillLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2563eb'
  },
  paginationContainer: {
    marginTop: 10,
    alignItems: 'center',
    gap: 8
  },
  paginationSummaryText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500'
  },
  paginationButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  pageNavBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  pageNavBtnDisabled: {
    opacity: 0.4
  },
  pageNavBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155'
  },
  pageNumberBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pageNumberBtnActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316'
  },
  pageNumberBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155'
  },
  pageNumberBtnTextActive: {
    color: '#ffffff'
  },
  emptyWrap: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500'
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 30,
    zIndex: 999
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    borderRadius: 8
  },
  pickerItemSelected: {
    backgroundColor: '#fff7ed'
  },
  pickerItemText: {
    fontSize: 13.5,
    color: '#334155',
    fontWeight: '600'
  },
  modalFieldWrap: {
    marginBottom: 12
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a'
  },
  modalOptionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6
  },
  modalOptionPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  modalOptionPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569'
  },
  modalOptionPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9'
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#475569'
  },
  modalSubmitBtn: {
    flex: 1.5,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalSubmitBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff'
  },
  manageSourcesHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  manageSourcesHeaderBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c'
  },
  manageSourcesOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  manageSourcesOutlineBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  manageSourcesModalFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  manageSourcesModalFooterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c'
  },
  addSourceSubmitBtn: {
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addSourceSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff'
  },
  manageSourceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  manageSourceNameText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a'
  },
  manageSourceCountText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  deleteSourceIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  attachedDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    padding: 10
  },
  attachedDocInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  attachedDocName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a'
  },
  attachedDocType: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  removeDocBtn: {
    padding: 4,
    marginLeft: 6
  },
  docPickerButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  docPickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  docPickActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ea580c'
  }
});
