import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { useToast } from '../hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare,
  Shield,
  AlertTriangle,
  Filter,
  RefreshCw,
  Edit3,
  Eye,
  BarChart3
} from 'lucide-react';

const SEVERITY_COLORS = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
};

const PLATFORM_COLORS = {
  twitter: 'bg-blue-500',
  youtube: 'bg-red-500',
  bluesky: 'bg-sky-500',
  instagram: 'bg-pink-500',
  facebook: 'bg-blue-600',
  discord: 'bg-indigo-500',
  twitch: 'bg-purple-500',
  reddit: 'bg-orange-500',
  tiktok: 'bg-black'
};

function ApprovalCard({ response, onApprove, onReject, loading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(response.response_text);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const { toast } = useToast();

  const handleApprove = async () => {
    try {
      await onApprove(response.id, isEditing ? editedText : null);
      toast({
        title: "Response approved",
        description: "The roast has been approved and queued for posting",
      });
    } catch (error) {
      toast({
        title: "Error approving response",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    try {
      await onReject(response.id, rejectionReason);
      setShowRejectForm(false);
      setRejectionReason('');
      toast({
        title: "Response rejected",
        description: "The roast has been rejected and will not be posted",
      });
    } catch (error) {
      toast({
        title: "Error rejecting response",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const platformColor = PLATFORM_COLORS[response.comment.platform] || 'bg-gray-500';
  const severityColor = SEVERITY_COLORS[response.comment.severity_level] || SEVERITY_COLORS.low;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${platformColor}`} />
            <span className="font-medium capitalize">{response.comment.platform}</span>
            <Badge variant="outline" className={severityColor}>
              {response.comment.severity_level}
            </Badge>
            {response.comment.toxicity_score && (
              <Badge variant="secondary">
                {Math.round(response.comment.toxicity_score * 100)}% toxic
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(response.created_at).toLocaleString()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Original Comment */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm font-medium">Original Comment</label>
            <Badge variant="outline">@{response.comment.platform_username}</Badge>
          </div>
          <div className="p-3 bg-muted rounded-lg text-sm">
            {response.comment.original_text}
          </div>
        </div>

        <Separator />

        {/* Generated Response */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Generated Roast</label>
              <Badge variant="outline">{response.tone}</Badge>
              <Badge variant="outline">{response.humor_type}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          </div>
          
          {isEditing ? (
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="min-h-20"
              placeholder="Edit the response text..."
            />
          ) : (
            <div className="p-3 bg-primary/5 rounded-lg text-sm border-l-4 border-primary">
              {response.response_text}
            </div>
          )}
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          {!showRejectForm ? (
            <div className="flex space-x-2">
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1"
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve {isEditing ? '& Edit' : ''}
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                variant="destructive"
                className="flex-1"
                size="sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Reason for rejection (optional)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-16"
              />
              <div className="flex space-x-2">
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                >
                  Confirm Reject
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCard({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-orange-600">
            {stats.pending_approval || 0}
          </div>
          <p className="text-sm text-muted-foreground flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {stats.approved || 0}
          </div>
          <p className="text-sm text-muted-foreground flex items-center">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-red-600">
            {stats.rejected || 0}
          </div>
          <p className="text-sm text-muted-foreground flex items-center">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold text-blue-600">
            {stats.posted || 0}
          </div>
          <p className="text-sm text-muted-foreground flex items-center">
            <MessageSquare className="h-3 w-3 mr-1" />
            Posted
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">
            {stats.approval_rate}%
          </div>
          <p className="text-sm text-muted-foreground flex items-center">
            <BarChart3 className="h-3 w-3 mr-1" />
            Approval Rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Approval() {
  const [pendingResponses, setPendingResponses] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [filters, setFilters] = useState({
    platform: '',
    limit: 20,
    offset: 0
  });
  const [pagination, setPagination] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    loadPendingResponses();
    loadStats();
  }, [filters]);

  const loadPendingResponses = async () => {
    try {
      const params = new URLSearchParams({
        limit: filters.limit,
        offset: filters.offset
      });
      
      if (filters.platform) {
        params.append('platform', filters.platform);
      }

      const response = await fetch(`/api/approval/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load pending responses');
      
      const data = await response.json();
      setPendingResponses(data.data.pending_responses);
      setPagination(data.data.pagination);
    } catch (error) {
      toast({
        title: "Error loading pending responses",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/approval/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load stats');
      
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const approveResponse = async (responseId, editedText) => {
    setProcessingIds(prev => new Set(prev).add(responseId));
    
    try {
      const payload = {};
      if (editedText) {
        payload.edited_text = editedText;
      }

      const response = await fetch(`/api/approval/${responseId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve response');
      }

      // Remove from pending list
      setPendingResponses(prev => prev.filter(r => r.id !== responseId));
      
      // Refresh stats
      await loadStats();
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(responseId);
        return next;
      });
    }
  };

  const rejectResponse = async (responseId, reason) => {
    setProcessingIds(prev => new Set(prev).add(responseId));
    
    try {
      const response = await fetch(`/api/approval/${responseId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject response');
      }

      // Remove from pending list
      setPendingResponses(prev => prev.filter(r => r.id !== responseId));
      
      // Refresh stats
      await loadStats();
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(responseId);
        return next;
      });
    }
  };

  const platforms = [...new Set(pendingResponses.map(r => r.comment.platform))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <Eye className="h-6 w-6" />
            <span>Response Approval</span>
          </h1>
          <p className="text-muted-foreground">
            Review and approve roast responses before they are posted to platforms
          </p>
        </div>
        <Button onClick={loadPendingResponses} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <StatsCard stats={stats} />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select
              value={filters.platform}
              onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value, offset: 0 }))}
            >
              <option value="">All Platforms</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>
                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pending Responses */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-muted rounded"></div>
                    <div className="h-20 bg-muted rounded"></div>
                    <div className="h-16 bg-muted rounded"></div>
                    <div className="flex space-x-2">
                      <div className="h-8 bg-muted rounded flex-1"></div>
                      <div className="h-8 bg-muted rounded flex-1"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pendingResponses.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {pendingResponses.map(response => (
                <ApprovalCard
                  key={response.id}
                  response={response}
                  onApprove={approveResponse}
                  onReject={rejectResponse}
                  loading={processingIds.has(response.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.has_more && (
              <div className="flex justify-center">
                <Button
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    offset: prev.offset + prev.limit
                  }))}
                  variant="outline"
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No pending responses</h3>
            <p className="text-muted-foreground">
              All roast responses have been reviewed. New responses will appear here when they're generated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}