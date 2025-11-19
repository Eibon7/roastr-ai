import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select } from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { useToast } from '../hooks/use-toast';
import { RoastrComment } from '../components/roastr/RoastrComment';
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

// Platform character limits
const PLATFORM_LIMITS = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 10000,
  discord: 2000,
  reddit: 40000,
  bluesky: 300,
  default: 1000
};

export function ApprovalCard({ response, onApprove, onReject, onRegenerate, loading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(response.response_text);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  // Character limit validation
  const platformLimit = PLATFORM_LIMITS[response.comment.platform] || PLATFORM_LIMITS.default;
  const currentLength = editedText.length;
  const isOverLimit = currentLength > platformLimit;
  const remainingChars = platformLimit - currentLength;

  const handleApprove = async () => {
    // Validate character limit before approving
    if (isEditing && isOverLimit) {
      toast({
        title: "Cannot approve response",
        description: `Response exceeds ${platformLimit} character limit for ${response.comment.platform}. Please shorten the text.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await onApprove(response.id, isEditing ? editedText : null);
      toast({
        title: "Response approved",
        description: "The roast has been approved and queued for posting",
      });
      setIsEditing(false); // Exit edit mode after successful approval
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

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await onRegenerate(response.id);
      toast({
        title: "Response regenerated",
        description: "A new roast has been generated for review",
      });
    } catch (error) {
      toast({
        title: "Error regenerating response", 
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="space-y-4 pt-6">
        {/* Attempt counter (approval-specific) */}
        {response.total_attempts > 1 && (
          <div className="flex justify-end">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Attempt {response.attempt_number}/{response.total_attempts}
            </Badge>
          </div>
        )}

        {/* Original Comment */}
        <RoastrComment
          author={response.comment.platform_username || 'Unknown'}
          handle={response.comment.platform_username ? `@${response.comment.platform_username}` : undefined}
          platform={response.comment.platform}
          timestamp={new Date(response.comment.created_at || response.created_at).toLocaleString()}
          content={response.comment.original_text}
          sentiment={
            response.comment.severity_level === 'critical' || response.comment.severity_level === 'high' 
              ? 'negative' 
              : response.comment.severity_level === 'low' 
              ? 'positive' 
              : 'neutral'
          }
          toxicityScore={response.comment.toxicity_score}
          tags={response.comment.severity_level ? [response.comment.severity_level] : []}
        />

        <Separator />

        {/* Generated Response */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Generated Roast</label>
              <Badge variant="outline">Tono: {response.tone || 'balanceado'}</Badge>
              {/* Issue #872: humor_type removed (deprecated post-#686) */}
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
            <div className="space-y-2">
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className={`min-h-20 ${isOverLimit ? 'border-red-500 focus:border-red-500' : ''}`}
                placeholder="Edit the response text..."
              />
              <div className="flex justify-between items-center text-xs">
                <span className={`${isOverLimit ? 'text-red-500' : remainingChars < 20 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  {currentLength}/{platformLimit} characters
                </span>
                {isOverLimit && (
                  <span className="text-red-500 font-medium">
                    {Math.abs(remainingChars)} characters over limit
                  </span>
                )}
                {remainingChars > 0 && remainingChars < 20 && (
                  <span className="text-yellow-500 font-medium">
                    {remainingChars} characters remaining
                  </span>
                )}
              </div>
              {isOverLimit && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  ⚠️ This response is too long for {response.comment.platform}. Please shorten it before approving.
                </div>
              )}
            </div>
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
            <>
              {/* Primary actions */}
              <div className="flex space-x-2">
                <Button
                  onClick={handleApprove}
                  disabled={loading || regenerating || (isEditing && isOverLimit)}
                  className={`flex-1 ${isEditing && isOverLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  size="sm"
                  title={isEditing && isOverLimit ? `Cannot approve: ${Math.abs(remainingChars)} characters over limit` : ''}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve {isEditing ? '& Edit' : ''}
                  {isEditing && isOverLimit && (
                    <span className="ml-1 text-xs">⚠️</span>
                  )}
                </Button>
                <Button
                  onClick={() => setShowRejectForm(true)}
                  disabled={loading || regenerating}
                  variant="destructive"
                  className="flex-1"
                  size="sm"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
              {/* Regenerate button */}
              <div className="flex">
                <Button
                  onClick={handleRegenerate}
                  disabled={loading || regenerating}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {regenerating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate
                </Button>
              </div>
            </>
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

  const regenerateResponse = async (responseId) => {
    try {
      const response = await fetch(`/api/approval/${responseId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate response');
      }

      const result = await response.json();
      
      // Remove old response from pending list
      setPendingResponses(prev => prev.filter(r => r.id !== responseId));
      
      // Reload pending responses to get the new one
      await loadPendingResponses();
      
      // Refresh stats
      await loadStats();
      
      return result;
    } catch (error) {
      throw error;
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
                  onRegenerate={regenerateResponse}
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