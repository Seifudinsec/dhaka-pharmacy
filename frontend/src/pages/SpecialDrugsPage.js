import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  faSearch,
  faPrescriptionBottleMedical,
  faUser,
  faIdCard,
  faPhone,
  faTrash,
  faEdit,
  faCalendarAlt,
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";
import AppIcon from "../components/common/AppIcon";
import useDebounce from "../hooks/useDebounce";
import { SkeletonTable } from "../components/common/SkeletonLoaders";
import { useAuth } from "../context/AuthContext";

export default function SpecialDrugsPage() {
  const { user: currentUser } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const debouncedSearch = useDebounce(search, 300);

  const fetchRecords = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const { data } = await api.get("/special-drugs", {
          params: { search: debouncedSearch, page, limit: 20 },
        });
        if (data.success) {
          setRecords(data.data);
          setPagination(data.pagination);
        }
      } catch {
        toast.error("Failed to load records.");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const { data } = await api.delete(`/special-drugs/${id}`);
      if (data.success) {
        toast.success("Record deleted successfully.");
        fetchRecords(pagination.page);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete record.");
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h2>
            <AppIcon
              icon={faPrescriptionBottleMedical}
              className="header-inline-icon"
            />{" "}
            Special Drugs Section
          </h2>
        </div>
        <div className="card-body p-0">
          <div className="p-3 border-bottom">
            <div className="search-box w-100">
              <span className="search-icon">
                <AppIcon icon={faSearch} tone="muted" />
              </span>
              <input
                className="form-control w-100"
                placeholder="Search by drug name, buyer name, ID or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div className="p-3">
                <SkeletonTable rows={10} cols={6} />
              </div>
            ) : !records.length ? (
              <div className="empty-state py-5">
                <AppIcon
                  icon={faPrescriptionBottleMedical}
                  size="xl"
                  tone="muted"
                />
                <h3>No records found</h3>
                <p className="text-muted">
                  Special drug records will appear here after sales.
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Drug Name</th>
                    <th>Buyer Name</th>
                    <th>Amount</th>
                    <th>ID Number</th>
                    <th>Phone</th>
                    <th>Prescription/Reason</th>
                    <th>Recorded By</th>
                    {currentUser?.role === "admin" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td data-label="Date">
                        <div className="d-flex flex-column">
                          <span className="font-medium">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-muted">
                            {new Date(r.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td data-label="Drug Name">
                        <strong>{r.drugName}</strong>
                      </td>
                      <td data-label="Buyer Name">
                        <div className="d-flex align-items-center gap-2">
                          <AppIcon icon={faUser} size="xs" tone="muted" />
                          {r.buyerName}
                        </div>
                      </td>
                      <td data-label="Amount">
                        <span className="font-bold text-secondary">
                          KES {Number(r.amount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td data-label="ID Number">
                        <div className="d-flex align-items-center gap-2">
                          <AppIcon icon={faIdCard} size="xs" tone="muted" />
                          {r.buyerIdNumber}
                        </div>
                      </td>
                      <td data-label="Phone">
                        <div className="d-flex align-items-center gap-2">
                          <AppIcon icon={faPhone} size="xs" tone="muted" />
                          {r.buyerPhoneNumber}
                        </div>
                      </td>
                      <td data-label="Prescription/Reason">
                        <div className="text-sm italic text-muted">
                          {r.prescription || "–"}
                        </div>
                      </td>
                      <td data-label="Recorded By">
                        <span className="badge badge-gray">
                          {r.recordedBy?.username || "Unknown"}
                        </span>
                      </td>
                      {currentUser?.role === "admin" && (
                        <td data-label="Actions">
                          <div className="d-flex gap-2">
                            <button
                              className="btn-icon text-red"
                              onClick={() => handleDelete(r._id)}
                              title="Delete Record"
                            >
                              <AppIcon icon={faTrash} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pagination.pages > 1 && (
            <div className="p-3 border-top d-flex justify-content-between align-items-center">
              <span className="text-sm text-muted">
                Showing page {pagination.page} of {pagination.pages}
              </span>
              <div className="pagination-btns">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page === 1}
                  onClick={() => fetchRecords(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm ml-2"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => fetchRecords(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
