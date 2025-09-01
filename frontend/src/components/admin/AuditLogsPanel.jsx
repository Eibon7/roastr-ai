/**
 * Audit Logs Panel Component
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Displays audit trail for all administrative actions
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  FileText, 
  Search, 
  Filter,
  Download,
  Clock,
  User,
  Activity,
  AlertTriangle,
  Settings,
  Power
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';

const AuditLogsPanel = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActionType, setSelectedActionType] = useState('all');
  const [selectedResourceType, setSelectedResourceType] = useState('all');
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50,
    total: 0
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAuditLogs();
  }, [pagination.offset, selectedActionType, selectedResourceType]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const filters = {
        limit: pagination.limit,
        offset: pagination.offset,
        ...(selectedActionType !== 'all' && { action_type: selectedActionType }),
        ...(selectedResourceType !== 'all' && { resource_type: selectedResourceType })
      };

      const response = await adminApi.getAuditLogs(filters);
      setLogs(response.data.logs);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total
      }));
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const filters = {
        ...(selectedActionType !== 'all' && { action_type: selectedActionType }),
        ...(selectedResourceType !== 'all' && { resource_type: selectedResourceType })
      };

      const blob = await adminApi.exportAuditLogs(filters, 'csv');
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      toast.error('Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const getActionIcon = (actionType) => {
    const icons = {
      kill_switch_toggle: <Power className="h-4 w-4 text-red-600" />,
      feature_flag_update: <Settings className="h-4 w-4 text-blue-600" />,
      user_suspend: <User className="h-4 w-4 text-orange-600" />,
      system_alert: <AlertTriangle className="h-4 w-4 text-yellow-600" />
    };
    return icons[actionType] || <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getActionBadgeColor = (actionType) => {
    const colors = {
      kill_switch_toggle: 'bg-red-100 text-red-800',
      feature_flag_update: 'bg-blue-100 text-blue-800',
      user_suspend: 'bg-orange-100 text-orange-800',
      system_alert: 'bg-yellow-100 text-yellow-800'
    };
    return colors[actionType] || 'bg-gray-100 text-gray-800';
  };

  const formatActionDescription = (log) => {
    if (log.description) {
      return log.description;
    }

    // Generate description based on action type
    switch (log.action_type) {
      case 'kill_switch_toggle':
        const newState = log.new_value?.enabled ? 'activated' : 'deactivated';
        return `Kill switch ${newState}`;
      case 'feature_flag_update':
        const flagState = log.new_value?.is_enabled ? 'enabled' : 'disabled';
        return `Feature flag '${log.resource_id}' ${flagState}`;
      default:
        return `${log.action_type} performed on ${log.resource_type}`;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.admin_user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const nextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
    }
  };

  const prevPage = () => {
    if (pagination.offset > 0) {
      setPagination(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit)
      }));
    }
  };

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={selectedActionType}
            onChange={(e) => setSelectedActionType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Actions</option>
            <option value="kill_switch_toggle">Kill Switch</option>
            <option value="feature_flag_update">Feature Flags</option>
            <option value="user_suspend">User Actions</option>
            <option value="system_alert">System Alerts</option>
          </select>
          <select
            value={selectedResourceType}
            onChange={(e) => setSelectedResourceType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Resources</option>
            <option value="kill_switch">Kill Switch</option>
            <option value="feature_flag">Feature Flag</option>
            <option value="user">User</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Audit Logs List */}
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {getActionIcon(log.action_type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionBadgeColor(log.action_type)}>
                        {log.action_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        by {log.admin_user?.email || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">
                      {formatActionDescription(log)}
                    </p>
                    {log.resource_id && (
                      <p className="text-xs text-gray-500 mb-2">
                        Resource: {log.resource_id}
                      </p>
                    )}
                    {(log.old_value || log.new_value) && (
                      <div className="text-xs text-gray-600 space-y-1">
                        {log.old_value && (
                          <div>
                            <span className="font-medium">Before:</span> {JSON.stringify(log.old_value)}
                          </div>
                        )}
                        {log.new_value && (
                          <div>
                            <span className="font-medium">After:</span> {JSON.stringify(log.new_value)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  {log.ip_address && (
                    <div className="mt-1">
                      IP: {log.ip_address}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLogs.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            No audit logs match your search criteria
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} logs
            </div>
            <div className="flex gap-2">
              <Button
                onClick={prevPage}
                disabled={pagination.offset === 0}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={nextPage}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogsPanel;
