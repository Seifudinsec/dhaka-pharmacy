import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  faCartShopping,
  faCheckCircle,
  faFileInvoiceDollar,
  faMagnifyingGlass,
  faPills,
  faXmark,
  faReceipt,
  faStickyNote,
  faPrescriptionBottleMedical,
  faUser,
  faIdCard,
  faPhone,
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";
import AppIcon from "../components/common/AppIcon";
import useDebounce from "../hooks/useDebounce";
import useDelayedLoading from "../hooks/useDelayedLoading";
import { SkeletonTable } from "../components/common/SkeletonLoaders";
import { useNotifications } from "../context/NotificationContext";

export default function BillingPage() {
  const { showPopup } = useNotifications();
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState("");
  const [specialDrugDetails, setSpecialDrugDetails] = useState({
    buyerName: "",
    buyerIdNumber: "",
    buyerPhoneNumber: "",
    prescription: "",
  });
  const [processing, setProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);

  const debouncedSearch = useDebounce(search, 200);
  const showFetchLoader = useDelayedLoading(fetchLoading);

  const fetchMedicines = useCallback(async () => {
    setFetchLoading(true);
    try {
      const { data } = await api.get("/medicines", {
        params: { limit: 500, status: "active" },
      });
      if (data.success) setMedicines(data.data || []);
    } catch {
      toast.error("Failed to load medicines.");
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const filtered = debouncedSearch.trim()
    ? medicines.filter((m) =>
        m.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : medicines;

  const addToCart = (medicine) => {
    const isExpired = new Date(medicine.expiryDate) <= new Date();
    if (isExpired) return toast.error(`"${medicine.name}" is expired.`);
    if (medicine.stock <= 0)
      return toast.error(`"${medicine.name}" is out of stock.`);

    setCart((prev) => {
      const exists = prev.find((i) => i._id === medicine._id);
      if (exists) {
        if (exists.qty >= medicine.stock) {
          toast.error(`Only ${medicine.stock} units available.`);
          return prev;
        }
        return prev.map((i) =>
          i._id === medicine._id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { ...medicine, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) => {
      const item = prev.find((i) => i._id === id);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter((i) => i._id !== id);
      const med = medicines.find((m) => m._id === id);
      if (newQty > (med?.stock || 0)) {
        toast.error(`Only ${med?.stock} units available.`);
        return prev;
      }
      return prev.map((i) => (i._id === id ? { ...i, qty: newQty } : i));
    });
  };

  const handleSale = async () => {
    if (!cart.length) return toast.error("Cart is empty.");

    // Check if any special drug details are filled
    const isSpecialDrugFilled = Object.values(specialDrugDetails).some(
      (v) => v.trim() !== "",
    );
    if (isSpecialDrugFilled) {
      const { buyerName, buyerIdNumber, buyerPhoneNumber } = specialDrugDetails;
      if (!buyerName || !buyerIdNumber || !buyerPhoneNumber) {
        return toast.error(
          "Please fill all special drug details or clear them all.",
        );
      }
    }

    setProcessing(true);
    try {
      const { data } = await api.post("/sales", {
        items: cart.map((i) => ({ medicineId: i._id, quantity: i.qty })),
        notes: notes.trim() || undefined,
        specialDrugDetails: isSpecialDrugFilled
          ? specialDrugDetails
          : undefined,
      });
      if (data.success) {
        toast.success("Sale processed successfully!");
        setLastReceipt({ ...data.data, cartSnapshot: [...cart] });

        // Show real-time popup for each item that is now low/out of stock
        const stockAlerts = data.stockAlerts || [];
        stockAlerts.forEach((alert) => {
          if (alert.alertType === "out_of_stock") {
            showPopup(
              "error",
              "Out of Stock",
              `${alert.name} is now out of stock.`,
              { route: `/inventory?highlight=${alert.id}` },
            );
          } else if (alert.alertType === "low_stock") {
            showPopup(
              "warning",
              "Low Stock Alert",
              `${alert.name}: only ${alert.stock} unit${alert.stock !== 1 ? "s" : ""} remaining.`,
              { route: `/inventory?highlight=${alert.id}` },
            );
          }
        });

        setCart([]);
        setNotes("");
        setSpecialDrugDetails({
          buyerName: "",
          buyerIdNumber: "",
          buyerPhoneNumber: "",
          prescription: "",
        });
        fetchMedicines();
        window.dispatchEvent(
          new CustomEvent("dataChanged", { detail: { type: "sale" } }),
        );
        if (data.warnings?.length) data.warnings.forEach((w) => toast.error(w));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Sale failed.");
      (err.response?.data?.errors || []).forEach((e) => toast.error(e));
    } finally {
      setProcessing(false);
    }
  };

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="billing-layout">
      <div className="card">
        <div className="card-header">
          <h2>
            <AppIcon icon={faMagnifyingGlass} className="header-inline-icon" />{" "}
            Select Medicines
          </h2>
        </div>
        <div className="card-body p-0">
          <div className="p-3 border-bottom">
            <div className="search-box w-100">
              <span className="search-icon">
                <AppIcon icon={faMagnifyingGlass} tone="muted" />
              </span>
              <input
                className="form-control w-100"
                placeholder="Search medicines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="table-wrap" style={{ maxHeight: 500 }}>
            {showFetchLoader ? (
              <div className="p-3">
                <SkeletonTable rows={6} cols={4} />
              </div>
            ) : !filtered.length ? (
              <div className="empty-state">
                <AppIcon icon={faPills} size="xl" tone="muted" />
                <h3>No medicines found</h3>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const inCart = cart.find((i) => i._id === m._id);
                    const isExpired = new Date(m.expiryDate) <= new Date();
                    const isOutOfStock = m.stock <= 0;
                    return (
                      <tr key={m._id}>
                        <td>
                          <strong>{m.name}</strong>
                        </td>
                        <td>KES {Number(m.price).toFixed(2)}</td>
                        <td>
                          {isExpired ? (
                            <span className="badge badge-red">Expired</span>
                          ) : isOutOfStock ? (
                            <span className="badge badge-red">
                              Out of stock
                            </span>
                          ) : (
                            <span
                              className={`badge ${m.stock < 10 ? "badge-amber" : "badge-green"}`}
                            >
                              {m.stock}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => addToCart(m)}
                            disabled={
                              isExpired ||
                              isOutOfStock ||
                              inCart?.qty >= m.stock
                            }
                          >
                            {inCart ? `+1 (${inCart.qty})` : "+ Add"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="billing-sidebar">
        <div className="card">
          <div className="card-header">
            <h2>
              <AppIcon
                icon={faFileInvoiceDollar}
                className="header-inline-icon"
              />{" "}
              Current Bill
            </h2>
            {cart.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCart([])}
              >
                Clear
              </button>
            )}
          </div>
          <div className="card-body min-h-200">
            {!cart.length ? (
              <div className="text-center py-5 text-muted">
                <AppIcon icon={faCartShopping} size="xl" />
                <p className="mt-2">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div className="bill-item" key={item._id}>
                  <div className="bill-item-info">
                    <div className="bill-item-name">{item.name}</div>
                    <div className="bill-item-price">
                      KES {item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="bill-item-qty">
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item._id, -1)}
                    >
                      −
                    </button>
                    <span className="qty-display">{item.qty}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item._id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="bill-item-subtotal">
                    KES {(item.price * item.qty).toFixed(2)}
                  </div>
                  <button
                    className="btn-icon text-muted"
                    onClick={() =>
                      setCart((c) => c.filter((i) => i._id !== item._id))
                    }
                  >
                    <AppIcon icon={faXmark} />
                  </button>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cart-checkout">
              <div className="special-drug-section border-bottom mb-3 pb-3">
                <h4 className="text-sm font-bold mb-2 d-flex align-items-center gap-2 text-secondary">
                  <AppIcon icon={faPrescriptionBottleMedical} />
                  Special Drug Details (Controlled)
                </h4>
                <div className="special-drug-grid">
                  <div className="form-group mb-2">
                    <label className="text-xs text-muted mb-1 d-block">
                      Buyer Name
                    </label>
                    <div className="input-with-icon-sm">
                      <AppIcon icon={faUser} className="input-icon-sm" />
                      <input
                        className="form-control form-control-sm"
                        placeholder="Full name..."
                        value={specialDrugDetails.buyerName}
                        onChange={(e) =>
                          setSpecialDrugDetails({
                            ...specialDrugDetails,
                            buyerName: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group mb-2">
                    <label className="text-xs text-muted mb-1 d-block">
                      ID Number
                    </label>
                    <div className="input-with-icon-sm">
                      <AppIcon icon={faIdCard} className="input-icon-sm" />
                      <input
                        className="form-control form-control-sm"
                        placeholder="ID/Passport..."
                        value={specialDrugDetails.buyerIdNumber}
                        onChange={(e) =>
                          setSpecialDrugDetails({
                            ...specialDrugDetails,
                            buyerIdNumber: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group mb-2">
                    <label className="text-xs text-muted mb-1 d-block">
                      Phone Number
                    </label>
                    <div className="input-with-icon-sm">
                      <AppIcon icon={faPhone} className="input-icon-sm" />
                      <input
                        className="form-control form-control-sm"
                        placeholder="Phone..."
                        value={specialDrugDetails.buyerPhoneNumber}
                        onChange={(e) =>
                          setSpecialDrugDetails({
                            ...specialDrugDetails,
                            buyerPhoneNumber: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div
                    className="form-group mb-2"
                    style={{ gridColumn: "span 2" }}
                  >
                    <label className="text-xs text-muted mb-1 d-block">
                      Prescription / Reason (Optional)
                    </label>
                    <div className="input-with-icon-sm">
                      <AppIcon icon={faStickyNote} className="input-icon-sm" />
                      <input
                        className="form-control form-control-sm"
                        placeholder="Prescription details or reason if none..."
                        value={specialDrugDetails.prescription}
                        onChange={(e) =>
                          setSpecialDrugDetails({
                            ...specialDrugDetails,
                            prescription: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="cart-notes-row">
                <label className="cart-notes-label">
                  <AppIcon icon={faStickyNote} />
                  Notes
                </label>
                <input
                  className="form-control"
                  placeholder="Add order notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="cart-summary">
                <div className="cart-summary-row">
                  <span className="cart-summary-label">Items</span>
                  <span className="cart-summary-value">
                    {cart.reduce((s, i) => s + i.qty, 0)}
                  </span>
                </div>
                <div className="cart-summary-row cart-summary-total">
                  <span className="cart-summary-label">Total</span>
                  <span className="cart-total-amount">
                    KES {total.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                className="btn-confirm-sale"
                onClick={handleSale}
                disabled={processing}
              >
                {processing ? (
                  <span className="spinner spinner-sm" />
                ) : (
                  <>
                    <AppIcon icon={faCheckCircle} />
                    Confirm Sale
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {lastReceipt && (
          <div className="card mt-3">
            <div className="card-header">
              <h2>
                <AppIcon
                  icon={faFileInvoiceDollar}
                  className="header-inline-icon"
                />{" "}
                Last Receipt
              </h2>
              <button className="btn-icon" onClick={() => setLastReceipt(null)}>
                <AppIcon icon={faXmark} />
              </button>
            </div>
            <div className="card-body">
              <div className="alert alert-success mb-2">Sale successful!</div>
              {lastReceipt.cartSnapshot.map((i) => (
                <div
                  key={i._id}
                  className="d-flex justify-content-between text-sm py-1 border-bottom"
                >
                  <span>
                    {i.name} ×{i.qty}
                  </span>
                  <span>KES {(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="d-flex justify-content-between mt-2 font-bold text-lg">
                <span>Total</span>
                <span className="text-secondary">
                  KES {lastReceipt.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
