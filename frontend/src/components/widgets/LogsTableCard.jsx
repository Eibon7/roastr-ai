import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Filter, FileText, Download } from 'lucide-react';

export default function LogsTableCard() {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/logs?limit=50');
        if (res.ok) {
          setLogs(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh every 15 seconds
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getLevelVariant = (level) => {
    switch (level) {
      case 'info':
        return 'outline';
      case 'warn':
        return 'warning';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const filteredLogs = logs
    ? logs.filter((log) => {
        const matchesLevel = filter === 'all' || log.level === filter;
        const matchesSearch =
          searchTerm === '' ||
          log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.service.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesLevel && matchesSearch;
      })
    : [];

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>System Logs</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {filteredLogs.length} entries
            </Badge>
            <button className="text-xs text-primary hover:underline flex items-center space-x-1">
              <Download className="h-3 w-3" />
              <span>Export</span>
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <div className="flex items-center space-x-1">
                <Filter className="h-4 w-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warnings</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        {filteredLogs.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider pb-2 border-b">
              <div className="col-span-2">Time</div>
              <div className="col-span-1">Level</div>
              <div className="col-span-2">Service</div>
              <div className="col-span-7">Message</div>
            </div>

            {/* Logs */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredLogs.slice(0, 25).map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-12 gap-4 text-sm py-2 px-2 hover:bg-muted/50 rounded"
                >
                  <div className="col-span-2 text-muted-foreground font-mono text-xs">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                  <div className="col-span-1">
                    <Badge variant={getLevelVariant(log.level)} className="text-xs px-1.5 py-0.5">
                      {log.level}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-muted-foreground">{log.service}</div>
                  <div className="col-span-7 text-foreground">
                    <div className="truncate" title={log.message}>
                      {log.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredLogs.length > 25 && (
              <div className="text-center py-2 text-xs text-muted-foreground">
                Showing 25 of {filteredLogs.length} entries
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <div className="text-sm mb-2">
              {searchTerm || filter !== 'all' ? 'No logs match your filters' : 'No logs available'}
            </div>
            {(searchTerm || filter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
