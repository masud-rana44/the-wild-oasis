import { getToday } from "../utils/helpers";
import supabase from "./supabase";

export async function getBookings({ filter, sortBy, page }) {
  let query = supabase
    .from("bookings")
    .select(
      "id, created_at, startDate, endDate, numNights, numGuests, status, totalPrice, cabins(name), guests(fullName, email)",
      { count: "exact" }
    );

  // FILTER
  if (filter !== null) query = query.eq(filter.field, filter.value);

  // SORT
  const isAscending = sortBy?.direction == "asc";
  if (sortBy !== null)
    query = query.order(sortBy.field, { ascending: isAscending });

  // PAGE
  if (page) {
    const from = (page - 1) * Number(import.meta.env.VITE_APP_PAGE_SIZE);
    const to = from + Number(import.meta.env.VITE_APP_PAGE_SIZE);
    query.range(from, to);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error(error);
    throw new Error("Bookings could not be loaded");
  }

  return { data, count };
}

export async function getBooking(id) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, cabins(*), guests(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Booking not found");
  }

  return data;
}

export async function createBooking({ cabinName, newGuest, newBooking }) {
  let updateBooking;

  // check if there is a cabin or Not
  const { data: cabinData, error: cabinError } = await supabase
    .from("cabins")
    .select("*")
    .eq("name", cabinName);

  if (cabinError) {
    console.error(cabinError);
    throw new Error(cabinError.message);
  }

    if (!cabinData.length) {
    throw new Error("No cabin found with this name");
  }

  // check is there already a guest with this email, If not create one
  const { data: guestDataOld, error: guestErrorOld } = await supabase
    .from("guests")
    .select("*")
    .eq("email", newGuest.email);

  if (guestErrorOld) {
    console.log(guestErrorOld);
    return;
  }

  if (guestDataOld.length === 0) {
    // create new guest
    const { data: guestDataNew, error: guestErrorNew } = await supabase
      .from("guests")
      .insert([newGuest])
      .select()
      .single();

    if (guestErrorNew) {
      console.error(cabinError);
      throw new Error("Guest could not created");
    }

    updateBooking = {
      ...newBooking,
      cabinId: cabinData.at(0).id,
      guestId: guestDataNew.id,
      cabinPrice:
        (cabinData.at(0).regularPrice - cabinData.at(0).discount) *
        newBooking.numNights,
      totalPrice:
        (cabinData.at(0).regularPrice - cabinData.at(0).discount) *
          newBooking.numNights +
        newBooking.extrasPrice,
    };
  } else {
    updateBooking = {
      ...newBooking,
      cabinId: cabinData.at(0).id,
      guestId: guestDataOld.at(0).id,
      cabinPrice:
        (cabinData.at(0).regularPrice - cabinData.at(0).discount) *
        newBooking.numNights,
      totalPrice:
        (cabinData.at(0).regularPrice - cabinData.at(0).discount) *
          newBooking.numNights +
        newBooking.extrasPrice,
    };
  }

  // Create new booking
  const { data, error } = await supabase
    .from("bookings")
    .insert([updateBooking]);
  if (error) {
    console.log(error);
    throw new Error(error.message);
  }

  return data;
}

// Returns all BOOKINGS that are were created after the given date. Useful to get bookings created in the last 30 days, for example.
// date: ISOString
export async function getBookingsAfterDate(date) {
  const { data, error } = await supabase
    .from("bookings")
    .select("created_at, totalPrice, extrasPrice")
    .gte("created_at", date)
    .lte("created_at", getToday({ end: true }));

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }

  return data;
}

// Returns all STAYS that are were created after the given date
export async function getStaysAfterDate(date) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, guests(fullName)")
    .gte("startDate", date)
    .lte("startDate", getToday());

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }

  return data;
}

// Activity means that there is a check in or a check out today
export async function getStaysTodayActivity() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, guests(fullName, nationality, countryFlag)")
    .or(
      `and(status.eq.unconfirmed,startDate.eq.${getToday()}),and(status.eq.checked-in,endDate.eq.${getToday()})`
    )
    .order("created_at");

  // Equivalent to this. But by querying this, we only download the data we actually need, otherwise we would need ALL bookings ever created
  // (stay.status === 'unconfirmed' && isToday(new Date(stay.startDate))) ||
  // (stay.status === 'checked-in' && isToday(new Date(stay.endDate)))

  if (error) {
    console.error(error);
    throw new Error("Bookings could not get loaded");
  }
  return data;
}

export async function updateBooking(id, obj) {
  const { data, error } = await supabase
    .from("bookings")
    .update(obj)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Booking could not be updated");
  }
  return data;
}

export async function deleteBooking(id) {
  // REMEMBER RLS POLICIES
  const { data, error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Booking could not be deleted");
  }
  return data;
}
